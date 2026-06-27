package main

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

const cookieName = "upquiz_token"
const tokenTTL = 24 * time.Hour

type registerReq struct {
	Email      string `json:"email" binding:"required,email"`
	Password   string `json:"password" binding:"required,min=6"`
	FullName   string `json:"full_name" binding:"required"`
	Role       string `json:"role"`
	Identifier string `json:"identifier"`
}

type loginReq struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func issueToken(userID, role string) (string, error) {
	claims := jwt.MapClaims{
		"sub":  userID,
		"role": role,
		"exp":  time.Now().Add(tokenTTL).Unix(),
		"iat":  time.Now().Unix(),
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString(jwtSecret)
}

// setAuthCookie issues an HTTP-only cookie holding the JWT.
func setAuthCookie(c *gin.Context, token string) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(cookieName, token, int(tokenTTL.Seconds()), "/", "", false, true)
}

func handleRegister(c *gin.Context) {
	var req registerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	role := req.Role
	if role != "student" && role != "educator" && role != "admin" {
		role = "student"
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "hash failed"})
		return
	}
	var id string
	err = db.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash, full_name, role, identifier)
		 VALUES ($1,$2,$3,$4,$5) RETURNING id`,
		strings.ToLower(req.Email), string(hash), req.FullName, role, req.Identifier).Scan(&id)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
		return
	}
	token, _ := issueToken(id, role)
	setAuthCookie(c, token)
	c.JSON(http.StatusCreated, gin.H{
		"user": gin.H{"id": id, "email": req.Email, "full_name": req.FullName, "role": role},
	})
}

func handleLogin(c *gin.Context) {
	var req loginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var id, hash, fullName, role, status string
	err := db.QueryRow(context.Background(),
		`SELECT id, password_hash, full_name, role, status FROM users WHERE email=$1`,
		strings.ToLower(req.Email)).Scan(&id, &hash, &fullName, &role, &status)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}
	if status == "inactive" {
		c.JSON(http.StatusForbidden, gin.H{"error": "account is deactivated"})
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}
	token, _ := issueToken(id, role)
	setAuthCookie(c, token)
	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{"id": id, "email": req.Email, "full_name": fullName, "role": role},
	})
}

func handleLogout(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(cookieName, "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// authMiddleware reads the JWT from the HTTP-only cookie (falling back to the
// Authorization header for API clients/tests).
func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := ""
		if ck, err := c.Cookie(cookieName); err == nil {
			tokenStr = ck
		} else if h := c.GetHeader("Authorization"); strings.HasPrefix(h, "Bearer ") {
			tokenStr = strings.TrimPrefix(h, "Bearer ")
		}
		if tokenStr == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
			return
		}
		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		claims := token.Claims.(jwt.MapClaims)
		c.Set("userID", claims["sub"])
		c.Set("role", claims["role"])
		c.Next()
	}
}

func requireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		for _, r := range roles {
			if role == r {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
	}
}

func handleMe(c *gin.Context) {
	userID, _ := c.Get("userID")
	var email, fullName, role string
	var identifier *string
	err := db.QueryRow(context.Background(),
		`SELECT email, full_name, role, identifier FROM users WHERE id=$1`, userID).
		Scan(&email, &fullName, &role, &identifier)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id": userID, "email": email, "full_name": fullName, "role": role, "identifier": identifier,
	})
}
