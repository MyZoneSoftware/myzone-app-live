import geopandas as gpd
import requests
import os

# -----------------------------
# CONFIG
# -----------------------------
OUTPUT_PATH = "server/data/parcels_enriched.geojson"

PARCELS_URL = "https://services1.arcgis.com/ZWOoUZbtaYePLlPw/arcgis/rest/services/Parcels/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson"
ZONING_URL = "https://maps.co.palm-beach.fl.us/arcgis/rest/services/OpenData/Planning_Open_Data/MapServer/9/query?outFields=*&where=1%3D1&f=geojson"
FLU_URL = "https://maps.co.palm-beach.fl.us/arcgis/rest/services/OpenData/Planning_Open_Data/MapServer/6/query?outFields=*&where=1%3D1&f=geojson"

# -----------------------------
# DOWNLOAD HELPERS
# -----------------------------
def load_geojson(url):
    print(f"Downloading: {url[:80]}...")
    r = requests.get(url)
    r.raise_for_status()
    return gpd.read_file(r.text)

# -----------------------------
# LOAD DATA
# -----------------------------
print("Loading parcels...")
parcels = gpd.read_file(PARCELS_URL)

print("Loading zoning...")
zoning = gpd.read_file(ZONING_URL)

print("Loading future land use...")
flu = gpd.read_file(FLU_URL)

# -----------------------------
# NORMALIZE CRS
# -----------------------------
TARGET_CRS = "EPSG:3857"
parcels = parcels.to_crs(TARGET_CRS)
zoning = zoning.to_crs(TARGET_CRS)
flu = flu.to_crs(TARGET_CRS)

# -----------------------------
# CLEAN PARCEL ATTRIBUTES
# -----------------------------
parcels = parcels.rename(columns={
    "PARCELID": "pcn",
    "SITUSADDRESS": "address",
    "OWNERNAME": "owner"
})

keep_cols = ["pcn", "address", "owner", "geometry"]
parcels = parcels[[c for c in keep_cols if c in parcels.columns]]

# -----------------------------
# AREA (ACRES)
# -----------------------------
parcels["area_acres"] = parcels.geometry.area * 0.000247105

# -----------------------------
# SPATIAL JOIN: ZONING
# -----------------------------
print("Joining zoning...")
zoning = zoning.rename(columns={
    "ZONING": "zoning"
})
parcels = gpd.sjoin(
    parcels,
    zoning[["zoning", "geometry"]],
    how="left",
    predicate="intersects"
).drop(columns=["index_right"], errors="ignore")

# -----------------------------
# SPATIAL JOIN: FLU
# -----------------------------
print("Joining future land use...")
flu = flu.rename(columns={
    "FLU": "future_land_use"
})
parcels = gpd.sjoin(
    parcels,
    flu[["future_land_use", "geometry"]],
    how="left",
    predicate="intersects"
).drop(columns=["index_right"], errors="ignore")

# -----------------------------
# FINAL CLEANUP
# -----------------------------
parcels = parcels.fillna("")

os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
parcels.to_file(OUTPUT_PATH, driver="GeoJSON")

print(f"✅ DONE: {OUTPUT_PATH}")
print(f"Total parcels: {len(parcels)}")
