# CivicPulse AI — Frontend

CivicPulse is an AI-powered civic intelligence platform designed to support citizen issue reporting, request classification, prioritization, and visualization.

This repository contains the frontend application for the CivicPulse platform. It provides separate interfaces for citizen issue submission and policymaker-oriented civic monitoring.

## Overview

The CivicPulse frontend provides:

- Citizen issue reporting
- Text and voice-based issue submission
- Multilingual issue reporting
- AI classification result display
- Severity and confidence visualization
- Interactive civic issue mapping
- District and category filtering
- Request monitoring
- Priority visualization
- Civic analytics
- Request detail views
- Loading, empty, cached-data, and error states
- Responsive user interface

The frontend communicates with the existing backend through the defined API contracts. The frontend does not modify or reinterpret the backend response structure.

## Main Interfaces

### Report an Issue

The citizen-facing submission interface allows users to:

- Enter a civic issue using text
- Submit a voice recording
- Record audio with a live waveform
- Use browser geolocation when available
- Select a district as a fallback
- Submit the request to the backend
- View the resulting request classification
- View severity and confidence information
- View whether the request requires manual review
- View the generated request reference ID

### Multilingual Issue Reporting

The Report an Issue interface currently supports four languages:

- English
- Tamil
- Hindi
- Kannada

Multilingual support is currently implemented for the issue reporting interface rather than the entire dashboard.

The language selection is handled at the frontend level while preserving the existing backend API structure.

### Policymaker Dashboard

The dashboard provides a consolidated view of civic requests and priorities.

It includes:

- District selection
- Category filtering
- Open request count
- Average confidence
- Demand hotspot count
- Top priority
- Requests requiring review
- Interactive civic map
- Severity distribution
- Recent requests
- Request details
- Priority information
- Recommendations and explanations

## Interactive Map

The dashboard uses Leaflet and OpenStreetMap for geographic visualization.

The map displays civic requests using markers whose appearance is based on issue severity.

Users can:

- View reported issue locations
- Identify severity through marker styling
- Select requests from the map
- Open request details
- Filter displayed requests using dashboard filters

## Dashboard Analytics

The dashboard calculates and displays several indicators from the available request data.

These include:

- Number of open requests
- Average classification confidence
- Demand hotspots
- Highest-priority category
- Number of requests requiring review
- Estimated affected population
- Most reported category
- Latest reported issue

## Priority Information

The dashboard displays the priority information returned by the backend.

Priority data includes information such as:

- Priority score
- Recommendation type
- Explanation
- Category

The frontend renders the values provided by the backend without changing the API field structure.

## Technology Stack

### Frontend

- React
- Vite
- JavaScript
- CSS

### Mapping

- Leaflet
- OpenStreetMap

### Icons

- Lucide React

### Deployment

- Firebase Hosting

## Project Structure

```text
frontend/
|
+-- src/
|   |
|   +-- components/
|   |   +-- AudioPlayer.jsx
|   |   +-- ConfidenceGauge.jsx
|   |   +-- LiveWaveform.jsx
|   |   +-- Map.jsx
|   |   +-- Map3D.jsx
|   |   +-- Modal.jsx
|   |   +-- PriorityPanel.jsx
|   |   +-- RequestDetailModal.jsx
|   |   +-- RequestsTable.jsx
|   |   +-- SeverityDonut.jsx
|   |   +-- SeverityMeter.jsx
|   |   +-- Skeleton.jsx
|   |   +-- StatRow.jsx
|   |   +-- SyntheticBanner.jsx
|   |   +-- labels.js
|   |   +-- mapSeverity.js
|   |
|   +-- i18n/
|   |   +-- strings.js
|   |
|   +-- pages/
|   |   +-- Dashboard.jsx
|   |   +-- Submit.jsx
|   |
|   +-- api.js
|   +-- constants.js
|   +-- App.jsx
|   +-- index.css
|   +-- main.jsx
|
+-- firebase.json
+-- .firebaserc
+-- .env.example
+-- package.json
+-- vite.config.js
