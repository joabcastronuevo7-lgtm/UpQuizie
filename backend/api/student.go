package main

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
)

// studentPerformance returns the signed-in student's own results and weak topics.
func studentPerformance(c *gin.Context) {
	userID, _ := c.Get("userID")
	ctx := context.Background()

	// Recent attempts
	rows, err := db.Query(ctx,
		`SELECT a.id, e.title, COALESCE(s.name,''), a.score, a.total_points, a.status, a.submitted_at
		 FROM student_exam_attempts a
		 JOIN exams e ON e.id = a.exam_id
		 LEFT JOIN subjects s ON s.id = e.subject_id
		 WHERE a.student_id = $1
		 ORDER BY a.submitted_at DESC NULLS LAST, a.started_at DESC
		 LIMIT 20`, userID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	attempts := []gin.H{}
	for rows.Next() {
		var id, title, subject, status string
		var score, total *int
		var submitted *time.Time
		rows.Scan(&id, &title, &subject, &score, &total, &status, &submitted)
		attempts = append(attempts, gin.H{
			"id": id, "title": title, "subject": subject, "score": score,
			"total_points": total, "status": status, "submitted_at": submitted,
		})
	}

	// Average percentage across completed attempts
	var avg *float64
	db.QueryRow(ctx,
		`SELECT AVG(score::float / NULLIF(total_points,0)) * 100
		 FROM student_exam_attempts
		 WHERE student_id = $1 AND status = 'completed'`, userID).Scan(&avg)

	// Weak topics (this student)
	trows, err := db.Query(ctx,
		`SELECT tp.topic, SUM(tp.correct), SUM(tp.total)
		 FROM topic_performance tp
		 JOIN student_exam_attempts a ON a.id = tp.attempt_id
		 WHERE a.student_id = $1
		 GROUP BY tp.topic
		 ORDER BY (SUM(tp.correct)::float / NULLIF(SUM(tp.total),0)) ASC`, userID)
	weak := []gin.H{}
	if err == nil {
		defer trows.Close()
		for trows.Next() {
			var topic string
			var correct, total int
			trows.Scan(&topic, &correct, &total)
			acc := 0.0
			if total > 0 {
				acc = float64(correct) / float64(total) * 100
			}
			weak = append(weak, gin.H{"topic": topic, "accuracy": acc, "weak": acc < 60})
		}
	}

	c.JSON(200, gin.H{"average_score": avg, "attempts": attempts, "weak_topics": weak})
}

// verifyExamAccess checks an access code before a student starts a protected exam.
func verifyExamAccess(c *gin.Context) {
	var req struct {
		Code string `json:"code"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	var code *string
	if err := db.QueryRow(context.Background(),
		`SELECT access_code FROM exams WHERE id=$1`, c.Param("id")).Scan(&code); err != nil {
		c.JSON(404, gin.H{"error": "exam not found"})
		return
	}
	if code == nil || *code == "" || *code == req.Code {
		c.JSON(200, gin.H{"ok": true})
		return
	}
	c.JSON(403, gin.H{"ok": false, "error": "invalid access code"})
}

// examAccessInfo reports whether an exam needs an access code (without revealing it).
func examAccessInfo(c *gin.Context) {
	var code *string
	if err := db.QueryRow(context.Background(),
		`SELECT access_code FROM exams WHERE id=$1`, c.Param("id")).Scan(&code); err != nil {
		c.JSON(404, gin.H{"error": "exam not found"})
		return
	}
	c.JSON(200, gin.H{"requires_code": code != nil && *code != ""})
}
