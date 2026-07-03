package main

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
)

// heartbeat records live progress and tab-focus for an in-progress attempt.
// Called periodically by the student's exam page so educators can monitor
// sessions in real time. Only the owning student may update, and completed
// attempts are never touched.
func heartbeat(c *gin.Context) {
	attemptID := c.Param("aid")
	userID, _ := c.Get("userID")
	var req struct {
		AnsweredCount int   `json:"answered_count"`
		Focused       *bool `json:"focused"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	focused := true
	if req.Focused != nil {
		focused = *req.Focused
	}
	if _, err := db.Exec(context.Background(),
		`UPDATE student_exam_attempts
		    SET answered_count=$1, focused=$2, last_seen_at=now()
		  WHERE id=$3 AND student_id=$4 AND status='in_progress'`,
		req.AnsweredCount, focused, attemptID, userID); err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

// examMonitor returns a live roster of every enrolled student for an exam,
// left-joined with their attempt so educators see who has not started, who is
// mid-exam (with progress + presence), and who has submitted.
func examMonitor(c *gin.Context) {
	examID := c.Param("id")
	ctx := context.Background()

	var title, status string
	var dur, pts int
	var subjectID *string
	if err := db.QueryRow(ctx,
		`SELECT title, status, duration_min, total_points, subject_id FROM exams WHERE id=$1`,
		examID).Scan(&title, &status, &dur, &pts, &subjectID); err != nil {
		c.JSON(404, gin.H{"error": "exam not found"})
		return
	}

	var questionCount int
	db.QueryRow(ctx, `SELECT count(*) FROM exam_questions WHERE exam_id=$1`, examID).Scan(&questionCount)

	rows, err := db.Query(ctx,
		`SELECT u.id, u.full_name, COALESCE(u.identifier,''),
		        a.id, a.status, a.answered_count, a.score, a.total_points,
		        a.started_at, a.submitted_at, a.last_seen_at, a.focused
		   FROM subject_enrollments se
		   JOIN users u ON u.id = se.student_id
		   LEFT JOIN student_exam_attempts a ON a.exam_id=$1 AND a.student_id=u.id
		  WHERE se.subject_id = $2
		  ORDER BY u.full_name`, examID, subjectID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	students := []gin.H{}
	var notStarted, inProgress, submitted int
	for rows.Next() {
		var sid, name, identifier string
		var attemptID, aStatus *string
		var answered, score, total *int
		var startedAt, submittedAt, lastSeen *time.Time
		var focused *bool
		rows.Scan(&sid, &name, &identifier, &attemptID, &aStatus, &answered, &score, &total,
			&startedAt, &submittedAt, &lastSeen, &focused)

		st := "not_started"
		if aStatus != nil {
			st = *aStatus
		}
		switch st {
		case "not_started":
			notStarted++
		case "in_progress":
			inProgress++
		default: // completed / needs_review
			submitted++
		}
		ac := 0
		if answered != nil {
			ac = *answered
		}
		students = append(students, gin.H{
			"student_id": sid, "name": name, "identifier": identifier,
			"attempt_id": attemptID, "status": st,
			"answered_count": ac, "question_count": questionCount,
			"score": score, "total_points": total,
			"started_at": startedAt, "submitted_at": submittedAt,
			"last_seen_at": lastSeen, "focused": focused,
		})
	}

	c.JSON(200, gin.H{
		"exam": gin.H{"id": examID, "title": title, "status": status,
			"duration_min": dur, "total_points": pts, "question_count": questionCount},
		"summary": gin.H{"enrolled": len(students), "not_started": notStarted,
			"in_progress": inProgress, "submitted": submitted},
		"students": students,
		// Server clock so the client computes presence without clock-skew issues.
		"now": time.Now(),
	})
}
