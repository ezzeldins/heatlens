# HeatLens Project Report

## Project overview

I built HeatLens as a local app for creating and comparing heatmaps from the FortyGuard Temperature API. The goal was to make the request workflow easier to use and to view results on a map.

## API workflow

The heatmap API works asynchronously. A submission returns an `activity_id`, which identifies the job; it does not contain the completed heatmap. The app uses that ID to check the job status and retrieve the result when processing is complete. This flow shaped the backend routes and the frontend's progress updates.

## Implementation

I used FastAPI and Pydantic to validate requests, preview the selected area, and communicate with FortyGuard. The backend keeps the API key out of the browser and saves completed runs locally. It also caches matching requests so users can reopen a saved result without submitting the same job again.

The frontend uses React and Leaflet. Users can select an area with a preset, draw a rectangle, or enter coordinates. They can configure the heatmap request, view results in different color styles, and compare completed runs for the same area and resolution.

## Testing

I added offline tests using `httpx.MockTransport` in place of the live API. The tests cover input validation, preview behavior, submission and status polling, caching, comparisons, and key-based run isolation. They do not require a live API key or use API credits.

## Current scope

Heatmap requests, saved runs, and comparisons are implemented. Other FortyGuard API services are not integrated into HeatLens yet.
