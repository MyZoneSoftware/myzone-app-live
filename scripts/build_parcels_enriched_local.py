#!/usr/bin/env python3
"""
Build a lightweight, normalized parcels GeoJSON for MyZone from LOCAL files only.

Inputs (expected paths):
  server/data/Parcels.geojson
  server/data/Zoning.geojson
  server/data/Future_Land_Use.geojson

Output:
  server/data/parcels_enriched.geojson

Normalized fields per feature:
  id (PCN), address, owner, zoning, flu, areaAcres, jurisdiction, lat, lng
"""

import argparse
import os
import sys
import warnings

warnings.filterwarnings("ignore", category=UserWarning)

def die(msg: str, code: int = 1):
    print(f"[ERROR] {msg}", file=sys.stderr)
    sys.exit(code)

def pick_first_existing(columns, candidates):
    cols = set(columns)
    for c in candidates:
        if c in cols:
            return c
    return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--parcels", default="server/data/Parcels.geojson")
    parser.add_argument("--zoning", default="server/data/Zoning.geojson")
    parser.add_argument("--flu", default="server/data/Future_Land_Use.geojson")
    parser.add_argument("--out", default="server/data/parcels_enriched.geojson")
    parser.add_argument("--limit", type=int, default=0, help="Optional: limit parcels for quick test (0 = all)")
    args = parser.parse_args()

    for p in [args.parcels, args.zoning, args.flu]:
        if not os.path.exists(p):
            die(f"Missing file: {p}  (copy it into this exact path/name)")

    print("[1/6] Importing GeoPandas / Shapely...")
    import geopandas as gpd

    print("[2/6] Reading parcels (this file is large; first run can take a while)...")
    # Read parcels. If pyogrio is available, GeoPandas will use it automatically.
    parcels = gpd.read_file(args.parcels)

    if args.limit and args.limit > 0:
        parcels = parcels.head(args.limit).copy()

    if parcels.empty:
        die("Parcels file read OK but contains 0 features.")

    # Identify key fields in parcels
    pcn_col = pick_first_existing(
        parcels.columns,
        ["PARID", "PCN", "PARCELID", "PARCEL_ID", "PARCEL_ID_", "parcel_id", "PARCELNO", "PARCEL_NO", "PID", "ID"]
    )
    if not pcn_col:
        die(f"Could not find PCN column in parcels. Available columns (first 40): {list(parcels.columns)[:40]}")

    acres_col = pick_first_existing(
        parcels.columns,
        ["ACRES", "ACRE", "AREA_ACRES", "area_acres", "ACREAGE"]
    )

    address_col = pick_first_existing(
        parcels.columns,
        ["ADDRESS", "SITUS", "SITUS_ADDR", "SITUS_ADDRESS", "SITE_ADDR", "SITE_ADDRESS", "PROPADDR", "PROPERTY_ADDRESS", "FULLADDR", "FULL_ADDRESS"]
    )

    owner_col = pick_first_existing(
        parcels.columns,
        ["OWNER", "OWNER_NAME", "OWNER1", "OWNERNAME", "OWNNAME", "OWN_NAME", "OWNERNM", "NAME", "OWNER_NM"]
    )

    # "Jurisdiction" – best-effort from common fields (county/muni code/name)
    juris_col = pick_first_existing(
        parcels.columns,
        ["JURISDICTION", "MUNI", "MUNICIPALITY", "CITY", "CITY_NAME", "CTY", "COUNTY", "COUNTYNAME"]
    )

    # Ensure CRS
    if parcels.crs is None:
        # Most ArcGIS GeoJSON exports are EPSG:4326
        parcels = parcels.set_crs("EPSG:4326")
    parcels = parcels[parcels.geometry.notnull()].copy()

    # Zoning + FLU
    print("[3/6] Reading zoning...")
    zoning = gpd.read_file(args.zoning)
    if zoning.crs is None:
        zoning = zoning.set_crs(parcels.crs)
    if zoning.crs != parcels.crs:
        zoning = zoning.to_crs(parcels.crs)

    print("[4/6] Reading future land use (FLU)...")
    flu = gpd.read_file(args.flu)
    if flu.crs is None:
        flu = flu.set_crs(parcels.crs)
    if flu.crs != parcels.crs:
        flu = flu.to_crs(parcels.crs)

    # Pick attribute names for zoning + FLU
    zoning_attr = pick_first_existing(
        zoning.columns,
        ["ZONING", "ZONING_DESC", "ZONINGDES", "ZONINGDIST", "ZONEDESC", "DISTRICT", "DIST_NAME", "NAME", "LABEL"]
    )
    if not zoning_attr:
        zoning_attr = pick_first_existing(zoning.columns, [c for c in zoning.columns if c != "geometry"])

    flu_attr = pick_first_existing(
        flu.columns,
        ["FLU", "FLU_DESC", "FUTURE_LAND_USE", "FUTURELANDUSE", "LANDUSE", "LAND_USE", "CATEGORY", "NAME", "LABEL"]
    )
    if not flu_attr:
        flu_attr = pick_first_existing(flu.columns, [c for c in flu.columns if c != "geometry"])

    if not zoning_attr:
        die("Could not determine a zoning attribute field (no non-geometry fields found in zoning layer).")
    if not flu_attr:
        die("Could not determine a FLU attribute field (no non-geometry fields found in FLU layer).")

    # Use spatial join – parcels should fall WITHIN zoning/FLU polygons
    # For performance, keep only necessary columns
    zoning_small = zoning[[zoning_attr, "geometry"]].rename(columns={zoning_attr: "__zoning__"})
    flu_small = flu[[flu_attr, "geometry"]].rename(columns={flu_attr: "__flu__"})

    print("[5/6] Spatial join: parcels -> zoning (within)...")
    pz = gpd.sjoin(parcels, zoning_small, how="left", predicate="within")
    # sjoin adds index_right; drop it
    if "index_right" in pz.columns:
        pz = pz.drop(columns=["index_right"])

    print("[5/6] Spatial join: parcels -> FLU (within)...")
    pzf = gpd.sjoin(pz, flu_small, how="left", predicate="within")
    if "index_right" in pzf.columns:
        pzf = pzf.drop(columns=["index_right"])

    # Build normalized output GeoDataFrame
    print("[6/6] Normalizing fields + writing output...")
    out = pzf[["geometry"]].copy()

    # id/pcn
    out["id"] = pzf[pcn_col].astype(str)

    # address / owner / jurisdiction (best effort)
    out["address"] = pzf[address_col].astype(str) if address_col else ""
    out["owner"] = pzf[owner_col].astype(str) if owner_col else ""
    out["jurisdiction"] = pzf[juris_col].astype(str) if juris_col else ""

    # zoning + flu
    out["zoning"] = pzf["__zoning__"].astype(str).fillna("")
    out["flu"] = pzf["__flu__"].astype(str).fillna("")

    # area acres
    if acres_col:
        # Coerce to float safely
        out["areaAcres"] = (
            pzf[acres_col]
            .astype(str)
            .str.replace(",", "", regex=False)
            .replace({"": "0", "None": "0", "nan": "0"})
        )
        out["areaAcres"] = out["areaAcres"].astype(float)
    else:
        # Compute from geometry (project to meters first)
        # EPSG:26917 (UTM 17N) is reasonable for Palm Beach County
        out_m = out.to_crs("EPSG:26917")
        out["areaAcres"] = (out_m.geometry.area / 4046.8564224).astype(float)

    # centroid lat/lng for fast UI display
    # NOTE: GeoPandas centroid on geographic CRS warns; we compute in UTM then convert back.
    out_m = out.to_crs("EPSG:26917")
    cent_m = out_m.geometry.centroid
    cent = gpd.GeoSeries(cent_m, crs="EPSG:26917").to_crs("EPSG:4326")
    out["lng"] = cent.x.astype(float)
    out["lat"] = cent.y.astype(float)

    # Keep ONLY normalized fields + geometry
    out = out[["id", "address", "owner", "jurisdiction", "zoning", "flu", "areaAcres", "lat", "lng", "geometry"]]

    # Write GeoJSON
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    out.to_file(args.out, driver="GeoJSON")

    print(f"[DONE] Wrote: {args.out}")
    print(f"       Features: {len(out)}")
    print("       Next: point your backend to read server/data/parcels_enriched.geojson")

if __name__ == "__main__":
    main()
