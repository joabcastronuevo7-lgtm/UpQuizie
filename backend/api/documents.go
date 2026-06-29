package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// uploadDocument accepts a multipart file, stores it in the shared uploads
// volume, records metadata, and asks the RAG service to extract + chunk + embed.
func uploadDocument(c *gin.Context) {
	subjectID := c.Param("id")
	userID, _ := c.Get("userID")

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(400, gin.H{"error": "file is required (multipart field 'file')"})
		return
	}

	docID := uuid.NewString()
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	storedName := fmt.Sprintf("%s%s", docID, ext)
	storedPath := filepath.Join(uploadDir, storedName)

	if err := c.SaveUploadedFile(fileHeader, storedPath); err != nil {
		c.JSON(500, gin.H{"error": "could not save file: " + err.Error()})
		return
	}

	ctx := context.Background()
	_, err = db.Exec(ctx,
		`INSERT INTO uploaded_documents (id, subject_id, uploaded_by, filename, file_type, file_path, size_bytes, status)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,'processing')`,
		docID, subjectID, userID, fileHeader.Filename, strings.TrimPrefix(ext, "."), storedPath, fileHeader.Size)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	go func() {
		body, _ := json.Marshal(gin.H{
			"document_id": docID,
			"subject_id":  subjectID,
			"file_path":   storedPath,
			"filename":    fileHeader.Filename,
		})
		client := http.Client{Timeout: 5 * time.Minute}
		resp, err := client.Post(ragURL+"/process", "application/json", bytes.NewReader(body))
		status := "ready"
		errMsg := ""
		if err != nil {
			status, errMsg = "error", err.Error()
		} else {
			if resp.StatusCode >= 300 {
				status, errMsg = "error", "rag process failed"
			}
			resp.Body.Close()
		}
		cctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		db.Exec(cctx, `UPDATE uploaded_documents SET status=$1, error=$2 WHERE id=$3`, status, errMsg, docID)
	}()

	c.JSON(201, gin.H{"id": docID, "status": "processing"})
}

func listDocuments(c *gin.Context) {
	rows, err := db.Query(context.Background(),
		`SELECT id, filename, file_type, size_bytes, status, error, created_at
		 FROM uploaded_documents WHERE subject_id=$1 ORDER BY created_at DESC`, c.Param("id"))
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	out := []gin.H{}
	for rows.Next() {
		var id, filename, status string
		var ftype, errMsg *string
		var size int64
		var created time.Time
		rows.Scan(&id, &filename, &ftype, &size, &status, &errMsg, &created)
		out = append(out, gin.H{"id": id, "filename": filename, "file_type": ftype,
			"size_bytes": size, "status": status, "error": errMsg, "created_at": created})
	}
	c.JSON(200, out)
}

// deleteDocument removes a learning material: the DB row (cascades chunks),
// the file on disk, and its vectors in Milvus (via the RAG service).
func deleteDocument(c *gin.Context) {
	docID := c.Param("docId")
	ctx := context.Background()

	var filePath string
	if err := db.QueryRow(ctx, `SELECT file_path FROM uploaded_documents WHERE id=$1`, docID).Scan(&filePath); err != nil {
		c.JSON(404, gin.H{"error": "document not found"})
		return
	}
	if _, err := db.Exec(ctx, `DELETE FROM uploaded_documents WHERE id=$1`, docID); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	if filePath != "" {
		_ = os.Remove(filePath)
	}

	go ragDelete("/document/" + docID)
	c.JSON(200, gin.H{"ok": true})
}

// updateSubject toggles a subject's status (active/archived) or edits fields.
func updateSubject(c *gin.Context) {
	var req struct {
		Status      *string `json:"status"`
		Name        *string `json:"name"`
		Department  *string `json:"department"`
		Description *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	if req.Status != nil && *req.Status != "active" && *req.Status != "archived" {
		c.JSON(400, gin.H{"error": "status must be 'active' or 'archived'"})
		return
	}
	_, err := db.Exec(context.Background(),
		`UPDATE subjects SET
		   status      = COALESCE($2, status),
		   name        = COALESCE($3, name),
		   department  = COALESCE($4, department),
		   description = COALESCE($5, description)
		 WHERE id=$1`,
		c.Param("id"), req.Status, req.Name, req.Department, req.Description)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

// deleteSubject removes a subject and everything under it (enrollments,
// documents, chunks, generated questions, exams) plus its Milvus vectors.
func deleteSubject(c *gin.Context) {
	subjectID := c.Param("id")
	if _, err := db.Exec(context.Background(), `DELETE FROM subjects WHERE id=$1`, subjectID); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	go ragDelete("/subject/" + subjectID)
	c.JSON(200, gin.H{"ok": true})
}

// ragDelete issues a best-effort DELETE to the RAG service.
func ragDelete(path string) {
	req, _ := http.NewRequest(http.MethodDelete, ragURL+path, nil)
	client := http.Client{Timeout: 30 * time.Second}
	if resp, err := client.Do(req); err == nil {
		resp.Body.Close()
	}
}

// generateQuestions forwards the request to the RAG service, which retrieves
// grounded context and writes new rows to generated_questions for educator review.
func generateQuestions(c *gin.Context) {
	subjectID := c.Param("id")
	var req struct {
		Topic        string `json:"topic"`
		Distribution []struct {
			Type       string `json:"type"`
			Difficulty string `json:"difficulty"`
			Count      int    `json:"count"`
			Points     int    `json:"points"`
		} `json:"distribution"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	body, _ := json.Marshal(gin.H{
		"subject_id":   subjectID,
		"topic":        req.Topic,
		"distribution": req.Distribution,
	})
	client := http.Client{Timeout: 10 * time.Minute}
	resp, err := client.Post(ragURL+"/generate", "application/json", bytes.NewReader(body))
	if err != nil {
		c.JSON(502, gin.H{"error": "RAG service unavailable: " + err.Error()})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		c.JSON(502, gin.H{"error": "RAG service error"})
		return
	}
	var ragOut map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&ragOut)
	c.JSON(200, ragOut)
}

// getGenerationStatus reports progress of an async generation job.
func getGenerationStatus(c *gin.Context) {
	var status string
	var requested, generated int
	var errMsg *string
	err := db.QueryRow(context.Background(),
		`SELECT status, requested, generated, error FROM generation_jobs WHERE id=$1`,
		c.Param("jobId")).Scan(&status, &requested, &generated, &errMsg)
	if err != nil {
		c.JSON(404, gin.H{"error": "job not found"})
		return
	}
	c.JSON(200, gin.H{"status": status, "requested": requested, "generated": generated, "error": errMsg})
}
