package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	_ "github.com/lib/pq"
	httpSwagger "github.com/swaggo/http-swagger"

	_ "travelrecap-backend/docs" // Swagger docs
)

type PlaceLocation struct {
	Lat     float64 `json:"lat"`
	Lng     float64 `json:"lng"`
	City    *string `json:"city"`
	Country *string `json:"country"`
	PlaceID string  `json:"place_id"`
}

func getDBConnection() (*sql.DB, error) {
	host := getEnv("DB_HOST", "postgres")
	port := getEnv("DB_PORT", "5432")
	user := getEnv("DB_USER", "travelrecap")
	password := getEnv("DB_PASSWORD", "travelrecap_password")
	dbname := getEnv("DB_NAME", "travelrecap")

	psqlInfo := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		host, port, user, password, dbname)

	db, err := sql.Open("postgres", psqlInfo)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	return db, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

// @title Travel Recap API
// @version 1.0
// @description API for retrieving travel location data filtered by year
// @host localhost:8080
// @BasePath /

// PlaceLocationsHandler handles GET requests for place locations
// @Summary Get place locations
// @Description Get place locations, optionally filtered by year. If year is not provided, returns all locations.
// @Tags locations
// @Accept json
// @Produce json
// @Param year query int false "Filter locations by year (e.g., 2023)"
// @Success 200 {array} PlaceLocation "List of place locations"
// @Failure 400 {object} map[string]string "Invalid year parameter"
// @Failure 500 {object} map[string]string "Database error"
// @Router /api/place-locations [get]
func placeLocationsHandler(w http.ResponseWriter, r *http.Request) {
	db, err := getDBConnection()
	if err != nil {
		log.Printf("Error connecting to database: %v", err)
		http.Error(w, "Database connection error", http.StatusInternalServerError)
		return
	}
	defer db.Close()

	// Get year parameter from query string
	yearParam := r.URL.Query().Get("year")
	var year *int
	if yearParam != "" {
		yearInt, err := strconv.Atoi(yearParam)
		if err != nil || yearInt < 1900 || yearInt > 2100 {
			http.Error(w, "Invalid year parameter. Must be a valid year between 1900 and 2100", http.StatusBadRequest)
			return
		}
		year = &yearInt
	}

	var rows *sql.Rows
	if year != nil {
		// Filter by year: join visits with place_locations and filter by year
		// Only include visits that have a place_id (non-null)
		startTime := time.Date(*year, 1, 1, 0, 0, 0, 0, time.UTC)
		endTime := time.Date(*year+1, 1, 1, 0, 0, 0, 0, time.UTC)

		rows, err = db.Query(`
			SELECT DISTINCT pl.lat, pl.lng, pl.city, pl.country, pl.place_id
			FROM place_locations pl
			INNER JOIN visits v ON pl.place_id = v.place_id
			WHERE v.start_time >= $1 AND v.start_time < $2 AND v.place_id IS NOT NULL
			ORDER BY pl.place_id
		`, startTime, endTime)
	} else {
		// Return all locations
		rows, err = db.Query(`
			SELECT lat, lng, city, country, place_id
			FROM place_locations
			ORDER BY place_id
		`)
	}

	if err != nil {
		log.Printf("Error querying place_locations: %v", err)
		http.Error(w, "Database query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var locations []PlaceLocation
	for rows.Next() {
		var loc PlaceLocation
		err := rows.Scan(&loc.Lat, &loc.Lng, &loc.City, &loc.Country, &loc.PlaceID)
		if err != nil {
			log.Printf("Error scanning row: %v", err)
			continue
		}
		locations = append(locations, loc)
	}

	if err := rows.Err(); err != nil {
		log.Printf("Error iterating rows: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(locations)
}

func main() {
	http.HandleFunc("/api/place-locations", corsMiddleware(placeLocationsHandler))

	// Swagger documentation endpoint
	http.HandleFunc("/swagger/", corsMiddleware(httpSwagger.WrapHandler))

	port := getEnv("PORT", "8080")
	log.Printf("Server starting on port %s", port)
	log.Printf("Swagger documentation available at http://localhost:%s/swagger/index.html", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
