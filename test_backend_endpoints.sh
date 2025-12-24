#!/usr/bin/env bash

echo "==> Testing backend endpoints on localhost:5003"

echo "--- Municipal Boundaries ---"
curl -v http://localhost:5003/api/municipal-boundaries || echo "Failed to reach municipal-boundaries"

echo
echo "--- Parcels GeoJSON ---"
curl -v http://localhost:5003/api/parcels-geojson || echo "Failed to reach parcels-geojson"

echo
echo "--- Zoning GeoJSON ---"
curl -v http://localhost:5003/api/zoning-geojson || echo "Failed to reach zoning-geojson"

echo
echo "--- Parcel by ID (sample) ---"
curl -v "http://localhost:5003/api/parcel-by-id?parid=70434418010000090" || echo "Failed to reach parcel-by-id"
