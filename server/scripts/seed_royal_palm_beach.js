const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const API_BASE = process.env.SEED_API_BASE || 'http://localhost:8080';

function log(step, data) { console.log(`[${step}]`, data); }
function slugify(s) {
  return s.toLowerCase()
    .replace(/&/g,'and')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}

async function postJSON(path, payload) {
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} ${res.status}: ${text}`);
  }
  return res.json();
}

(async () => {
  try {
    const jurisdiction = {
      name: "Royal Palm Beach",
      type: "municipality",
      county: "Palm Beach",
      population: 40018,
      area_sq_miles: 10.1,
      label: "Village",
      arcgis: {
        viewer: "https://royalpalmbeach.maps.arcgis.com/apps/webappviewer/index.html?id=1f3868bd1fc5403a81ae93b3cb26d2c8",
        layerId: null,
        zoningField: "ZONING"
      }
    };
    const jxResp = await postJSON('/api/jurisdictions/import', { jurisdictions: [jurisdiction] });
    const JX_ID = (jxResp.inserted || jxResp.upserted || jxResp[0] || jxResp).id || jxResp.id || jxResp._id;
    log('jurisdiction_id', JX_ID);

    const districts = [
      { code: "RS-2", name: "Single Family Residential (RS-2)", jurisdiction_id: JX_ID, site_standards: {
        min_lot_area_sqft: 8000, min_lot_width_ft: 80, max_height_ft: 30, max_stories: 2,
        setbacks: { front_ft: 25, rear_ft: 20, side_interior_ft: 10, side_corner_ft: 15, rear_screened_enclosure_ft: 10 },
        min_floor_area_sqft: 1500, max_lot_coverage_percent: 35, min_pervious_percent: 50,
        notes: ["Special rear/side setbacks for specified Palm Beach Colony plats", "See Ch.23 parking; §15-130 landscaping; Ch.20 signs"],
        max_density_du_per_acre: 5
      }},
      { code: "RS-3", name: "Single Family Residential (RS-3)", jurisdiction_id: JX_ID, site_standards: {
        min_lot_area_sqft: 7000, min_lot_width_ft: 65, min_lot_depth_ft: 100, max_height_ft: 30, max_stories: 2,
        setbacks: { front_ft: 25, rear_ft: 15, side_interior_ft: 7.5, side_corner_ft: 15, rear_screened_enclosure_ft: 10 },
        min_floor_area_sqft: 1500, max_lot_coverage_percent: 40, min_pervious_percent: 20,
        notes: ["See Ch.23 parking; §15-130 landscaping; Ch.20 signs"], max_density_du_per_acre: 5
      }},
      { code: "RMU", name: "Residential Mixed Use (RMU)", jurisdiction_id: JX_ID, site_standards: {
        min_parcel_size_acres: 3, max_height_ft: 32,
        setbacks_matrix: "See supplied RMU table (front/rear/side vs adjacencies)",
        min_common_open_space_percent: 30, min_pervious_percent: 50,
        floor_area: { attached_avg_sqft: 1200, one_bed_min: 1000, two_bed_min: 1200, three_bed_min: 1350, duplex_min_no_gar: 1500, duplex_min_1car: 1450, duplex_min_2car: 1400 },
        max_grouping_length_units: 6,
        notes: ["See Ch.23 parking; §15-130 landscaping; Ch.20 signs"], max_density_du_per_acre: 5
      }},
      { code: "RV-6", name: "Villa Residential (RV-6)", jurisdiction_id: JX_ID, site_standards: {
        min_parcel_size_acres: 3, max_height_ft: 20, min_pervious_percent: 50, min_common_open_space_percent: 30,
        setbacks_matrix: "See supplied RV-6 table (front/rear/side vs adjacencies)",
        floor_area: { attached_avg_sqft: 1200, one_bed_min: 1000, two_bed_min: 1200, three_bed_min: 1350, duplex_min_no_gar: 1500, duplex_min_1car: 1450, duplex_min_2car: 1400 },
        max_grouping_length_units: 6, zero_lot_line_frontage_ft: 55, min_unit_width_ft: 30,
        notes: ["See Ch.23 parking; §15-130 landscaping; Ch.20 signs"], max_density_du_per_acre: 6
      }},
      { code: "RT-8", name: "Townhouse Residential (RT-8)", jurisdiction_id: JX_ID, site_standards: {
        min_parcel_size_acres: 3, max_height_ft: 30, min_pervious_percent: 50, min_common_open_space_percent: 30,
        setbacks_matrix: "See supplied RT-8 table (front/rear/side vs adjacencies)",
        floor_area: { attached_avg_sqft: 1200, one_bed_min: 1000, two_bed_min: 1200, three_bed_min: 1350 },
        max_grouping_length_units: 6,
        notes: ["See Ch.23 parking; §15-130 landscaping; Ch.20 signs"], max_density_du_per_acre: 8
      }},
      { code: "RM-9", name: "Multiple Family Residential (RM-9)", jurisdiction_id: JX_ID, site_standards: {
        min_parcel_size_acres: 2.5, min_parcel_width_ft: 200, max_height_ft: 32, max_stories: 3,
        setbacks: { front_ft: 50, rear_ft: 30, side_interior_ft: 20, side_corner_or_between_ft: 40 },
        min_landscape_buffer: { row_ft: 35, lower_density_adj_ft: 25, multifamily_adj_ft: 15 },
        min_pervious_percent: 50, min_common_open_space_percent: 30, max_grouping_length_units: 8,
        floor_area: { one_bed_min: 1000, two_bed_min: 1200, three_bed_min: 1350, building_avg_per_unit_sqft: 1200 },
        notes: ["Extra setbacks when adjacent to lower density", "See Ch.23 parking; §15-130 landscaping; Ch.20 signs"]
      }},
      { code: "RM-12", name: "Multiple Family Residential (RM-12)", jurisdiction_id: JX_ID, site_standards: {
        min_parcel_size_acres: 3, min_parcel_width_ft: 200, max_height_ft: 32, max_stories: 3,
        setbacks: { front_ft: 50, rear_ft: 30, side_interior_ft: 20, side_corner_or_between_ft: 40, side_child_care_ft: 50, rear_child_care_ft: 50 },
        min_landscape_buffer: { row_ft: 35, interior_ft: 15, public_open_space_ft: 0 },
        min_pervious_percent_by_avg_unit_size: { up_to_1199: 58, _1200_1299: 57, _1300_1399: 56, _1400_1499: 55, _1500_1599: 54, over_1600: 53 },
        max_building_coverage_percent: 25, min_common_open_space_percent: 25,
        floor_area: { one_bed_min: 1000, two_bed_min: 1200, three_bed_min: 1350, building_avg_per_unit_sqft: 1200 },
        max_density_du_per_acre: 12,
        notes: ["See Ch.23 parking; §15-130 landscaping; Ch.20 signs"]
      }},
      { code: "RM-14", name: "Multiple Family Residential (RM-14)", jurisdiction_id: JX_ID, site_standards: {
        min_parcel_size_acres: 3, min_parcel_width_ft: 200, max_height_ft: 32, max_stories: 3,
        setbacks: { front_ft: 50, rear_ft: 30, side_interior_ft: 20, side_corner_or_between_ft: 40, side_child_care_ft: 50, rear_child_care_ft: 50 },
        min_landscape_buffer: { row_ft: 35, interior_ft: 15, public_open_space_ft: 0 },
        min_pervious_percent_by_avg_unit_size: { up_to_1199: 50, _1200_1299: 49, _1300_1399: 48, _1400_1499: 47, _1500_1599: 46, over_1600: 45 },
        max_building_coverage_percent: 25, min_common_open_space_percent: 25,
        floor_area: { one_bed_min: 1000, two_bed_min: 1200, three_bed_min: 1350, building_avg_per_unit_sqft: 1200 },
        max_density_du_per_acre: 14,
        notes: ["See Ch.23 parking; §15-130 landscaping; Ch.20 signs"]
      }},
      { code: "RM-18", name: "Multiple Family Residential (RM-18)", jurisdiction_id: JX_ID, site_standards: { notes: ["Same as RM-14 (per user)"] }},
      { code: "CO", name: "Office Commercial (CO)", jurisdiction_id: JX_ID, site_standards: {
        min_parcel_size_sqft: 20000, min_parcel_width_ft: 100, max_height_ft: 32, max_stories: 3,
        setbacks: { front_ft: 50, rear_ft: 30, side_interior_ft: 20, side_corner_ft: 50, exceptions: [{ front_ft: 30, side_corner_ft: 30, condition: "front+corner fully landscaped; no parking/driveway" }] },
        min_pervious_percent: 30, pervious_exception: "20% if abutting WMD canal",
        notes: ["See Ch.23 parking; §15-130 landscaping; Ch.20 signs"]
      }},
      { code: "CN", name: "Neighborhood Commercial (CN)", jurisdiction_id: JX_ID, site_standards: {
        min_parcel_size_sqft: 24000, min_parcel_width_ft: 80, max_height_ft: 32, max_stories: 2,
        setbacks: { front_ft: 170, rear_ft: 36, side_interior_ft: 15, side_corner_ft: 30 },
        min_pervious_percent: 20,
        tract_106_conditions: true,
        notes: ["See Ch.23 parking; §15-130 landscaping; Ch.20 signs"]
      }},
      { code: "CG", name: "General Commercial (CG)", jurisdiction_id: JX_ID, site_standards: {
        min_parcel_size_sqft: 40000, min_parcel_width_ft: 150, max_height_ft: 32, max_stories: 2,
        setbacks: { front_ft: 50, rear_ft: 30, side_interior_ft: 0, side_corner_ft: 50 },
        min_pervious_percent: 25, pervious_exception: "20% if abutting WMD canal",
        notes: ["See Ch.23 parking; §15-130 landscaping; Ch.20 signs"]
      }},
      { code: "PR", name: "Private Recreation (PR)", jurisdiction_id: JX_ID, site_standards: {
        min_parcel_size_acres: 5, min_parcel_width_ft: 200, max_height_ft: 32, max_stories: 2,
        setbacks: { front_ft: 100, rear_ft: 100, side_interior_ft: 100, side_corner_ft: 100 },
        min_pervious_percent: 20,
        lighting: "No spill to adjacent properties; recreational lighting off 11:00 p.m. – 6:00 a.m.",
        notes: ["See Ch.23 parking; §15-130 landscaping; Ch.20 signs"]
      }},
      { code: "PO", name: "Public Ownership (PO)", jurisdiction_id: JX_ID, site_standards: {
        determination: "Set by Village Council upon staff and P&Z recommendations",
        notes: ["See Ch.23 parking; §15-130 landscaping; Ch.20 signs"]
      }},
      { code: "IL", name: "Industrial Limited (IL)", jurisdiction_id: JX_ID, site_standards: {
        min_parcel_size_acres: 2, min_parcel_width_ft: 150, max_height_ft: 32, max_stories: 2,
        setbacks: { front_ft: 60, rear_ft: 25, side_interior_ft: 20, side_corner_ft: 30, landscaped_front_corner: true },
        min_pervious_percent: 20,
        storage: "No outside unenclosed storage except as otherwise set forth",
        residential_wall: "8-ft landscaped masonry wall when adjacent to residential (timing per code)",
        pod_note: "See §26-75(c) for planned industrial development minimums",
        notes: ["See Ch.23 parking; §15-130 landscaping; Ch.20 signs"]
      }},
      { code: "IG", name: "Industrial General (IG)", jurisdiction_id: JX_ID, site_standards: {
        min_parcel_size_acres: 3, min_parcel_width_ft: 200, max_height_ft: 32, max_stories: 2,
        setbacks: { front_ft: 75, rear_ft: 35, side_interior_ft: 25, side_corner_ft: 40, landscaped_row: true },
        min_pervious_percent: 20,
        enclosed_storage: "Exterior storage enclosed by 8-ft solid masonry fence; neat from ROW",
        residential_wall: "8-ft landscaped masonry wall when adjacent to residential (timing per code)",
        pod_note: "See §26-75(c) for planned industrial development minimums",
        notes: ["See Ch.23 parking; §15-130 landscaping; Ch.20 signs"]
      }}
    ];
    const dResp = await postJSON('/api/districts/import', { districts });
    log('districts', dResp?.count || dResp);

    const useNames = [
      "Single-family detached dwellings","Patio homes / zero-lot-line homes","Duplexes","Villa dwellings","Townhouse dwellings","Multifamily dwellings",
      "Public parks, golf courses and other recreational facilities","Community residential homes (≤14 residents)","Community residential homes (>14 residents)","Family child care home","Church or place of worship",
      "Public academic institution","Private academic institution","Senior housing facility","PUD - Planned Unit Development",
      "Abstract title and insurers","Accountants and bookkeepers","Actuaries","Advertising / public relations agencies","Aerial survey and photography","Appraisers","Architects","Attorneys","Auditors",
      "Chiropractors","Contractor’s office","Computer services","Counseling, child guidance and family services","Credit reporting","Dentists","Drafting and plan services","Engineers","Financial counseling",
      "Financial institution (without drive-through)","Funeral home (without crematory)","Government offices and facilities","Governmental services","Insurance agencies and adjusters","Interior designer",
      "Investigation agency","Investment / brokerage services","Laser therapy — Aesthetic and/or therapeutic","Manufacturers’ agents","Market research","Messenger and delivery service","Notary public",
      "Opticians","Optometrists","Personal counseling","Physicians","Podiatrists","Public and private utilities","Real estate agencies","Real estate management","Restaurant (without drive-through)","Secretarial services","Stenographers","Surgeons","Tax consultants","Theater ticket agencies","Travel agencies",
      "Bakery","Barbershop","Beauty shop","Book or stationery store","Convenience store","Copying services","Craft shop","Drugstore and/or pharmacy","Dry cleaning facility","Florist","Gift shop","Hardware store","Health and exercise studio","Hobby shop","Ice cream parlor","Jewelry store","Laundromat","Liquor and package store","Locksmith","Music / video shop","Nail salon","Newsstand","Optical store","Paint store","Pet grooming","Pet supply store","Photographic supply and camera shop","Shoe repair","Sporting goods store","Tailor / seamstress","Tanning salons","Tobacco shop","Veterinarian’s clinic with boarding","Window treatment store",
      "Art and graphic supply","Art gallery","Automobile alarm/audio sales and installation","Automobile parts and accessory sales","Bicycle shop","Broadcasting studio","Catalog sales","Catering service","Clothing store","Computer store","Consignment shop","Department store","Electronics sales and facility","Employment / recruitment services","Furniture store","Glassware and flatware store","Graphics / drafting service","Grocery store","Home improvement center","Leather goods store","Library","Lodges, fraternal and service organizations","Luggage shop","Movie theater (indoor)","New and used vehicle sales and service (indoor)","Shoe store","Bar or lounge (without live entertainment)","Pet sales",
      "Football, soccer, baseball fields","Handball and racquetball courts","Swimming pools","Tennis clubs","Lawn equipment repair (indoor)","Outdoor commercial recreation facilities","Private golf courses/driving ranges, clubhouses","Private recreation facilities",
      "Fire station","Police station","Solid waste transfer stations","Water and wastewater plants",
      "Financial institution with drive-through","Restaurant with drive-through","Child day care center","Birthing center","Parking garage","Planned commercial development","State licensed massage therapist establishment","Veterinary oncology centers (no overnight stay)","Amusement arcade","Automotive service stations","Bar, lounge or restaurant with live entertainment","Bowling alley","Brewpub (≤6,000 sq ft)","Business, trade or vocational school","Car wash (self-service or other)","Drugstore or pharmacy with drive-through","Dry cleaning facility with drive-through","Hotel and/or motel","Integrated care center","Kennels with or without runs","Microbrewery (≤6,000 sq ft)","New and used vehicle sales (outdoor)","Recreational facilities, commercial (outdoor or indoor)","Resort and convention center","Tire sales and installation","Vehicle auction sales","Veterinarian’s clinic with outside run","Green market","Law enforcement training facilities","Telecommunication towers; antenna",
      "Assembly, non-profit","Automobile brokerage","Bakery (wholesale)","Boat and RV storage facility","Building supplies facility (retail or wholesale)","Car wash and/or automobile detailing","Catering service and/or food preparation","Contractor's office, shop and accessory retail","Data information processing","Dry cleaning/Laundry service (industrial)","Exterminators","Fire/burglar alarm companies","Fire extinguisher, sales and service","Fitness center","Janitorial services","Landscape maintenance service","Machine or welding shop","Medical marijuana treatment center","Medical or dental laboratory","Monument sales, retail","Motion picture production studio","Office, business or professional","Printing and copying services","Research/development center","Restaurant (not fast food type)","School; business, trade, studio or vocational only","Self service storage facility","Transportation facility","Warehouse and storage building","Wholesale office-warehouse combination","Wholesale, general",
      "Adult entertainment establishments","Asphalt or concrete plant","Automobile and/or water craft repair and/or service; service station","Automobile paint and/or body shop","Automobile/truck rental agencies (indoor or outdoor)","Chipping or mulching","Communication cell sites on wheels (COWs)","Convenience store with gas sales","Day labor employment service","Electrical power facilities","Funeral home with crematory","Gas and fuel, wholesale","Hotel and/or motel","Kennels","Manufacturing, limited processing and assembly","Medical research","Memory care facility","Nursery, retail","Planned industrial development","Recycling, collection station and/or drop off bin","Restaurant, fast food","Small engine repair","Telecommunication towers, antenna","Towing service and/or storage","Warehouse and storage building over 400,000 sq ft","Water craft brokerage","Vehicle sales and/or rental (indoor and outdoor)",
      "Brewery","Fleet vehicle storage and maintenance facility","Landscape service and nursery","Senior housing facility","Park and ride facility","Public or private academic institution"
    ];

    const uses = Array.from(new Set(useNames)).map(name => ({ name, slug: slugify(name), synonyms: [] }));
    const uResp = await postJSON('/api/uses/import', { uses });
    log('uses', uResp?.count || uResp);

    const P = [];
    const addPerm = (district_code, use_name, status, notes=null, citations=[]) => {
      const slug = slugify(use_name);
      P.push({ jurisdiction_id: JX_ID, district_code, use_slug: slug, status, notes: notes || undefined, citations: citations.length? citations: undefined });
    };

    ["Single-family detached dwellings","Public parks, golf courses and other recreational facilities","Community residential homes (≤14 residents)","Family child care home"].forEach(u => addPerm("RS-2", u, "permitted"));
    ["Church or place of worship","Public academic institution","Private academic institution","Public and private utilities"].forEach(u => addPerm("RS-2", u, "conditional", "Utilities may exceed height if approved by special exception"));
    addPerm("RS-2","All other uses not listed","prohibited");

    ["Single-family detached dwellings","Patio homes / zero-lot-line homes","Public parks, golf courses and other recreational facilities","Community residential homes (≤14 residents)","Family child care home"].forEach(u => addPerm("RS-3", u, "permitted"));
    ["Church or place of worship","Public academic institution","Private academic institution","Public and private utilities","PUD - Planned Unit Development"].forEach(u => addPerm("RS-3", u, "conditional", "Utilities may exceed height if approved by special exception"));
    addPerm("RS-3","All other uses not listed","prohibited");

    ["Single-family detached dwellings","Patio homes / zero-lot-line homes","Duplexes","Villa dwellings","Multifamily dwellings","Public parks, golf courses and other recreational facilities","Community residential homes (≤14 residents)","Family child care home"].forEach(u => addPerm("RMU", u, "permitted"));
    ["Church or place of worship","Public academic institution","Private academic institution","Public and private utilities","Community residential homes (>14 residents)","PUD - Planned Unit Development","Senior housing facility"].forEach(u => addPerm("RMU", u, "conditional"));
    addPerm("RMU","All other uses not listed","prohibited");

    ["Villa dwellings","Single-family detached dwellings","Duplexes","Patio homes / zero-lot-line homes","Public parks, golf courses and other recreational facilities","Community residential homes (≤14 residents)","Family child care home"].forEach(u => addPerm("RV-6", u, "permitted"));
    ["Church or place of worship","Public academic institution","Private academic institution","Public and private utilities","Community residential homes (>14 residents)","PUD - Planned Unit Development","Senior housing facility"].forEach(u => addPerm("RV-6", u, "conditional"));
    addPerm("RV-6","All other uses not listed","prohibited");

    ["Townhouse dwellings","Villa dwellings","Single-family detached dwellings","Duplexes","Patio homes / zero-lot-line homes","Public parks, golf courses and other recreational facilities","Community residential homes (≤14 residents)","Family child care home"].forEach(u => addPerm("RT-8", u, "permitted"));
    ["Church or place of worship","Public academic institution","Private academic institution","Public and private utilities","Community residential homes (>14 residents)","PUD - Planned Unit Development","Senior housing facility"].forEach(u => addPerm("RT-8", u, "conditional"));
    addPerm("RT-8","All other uses not listed","prohibited");

    ["Multifamily dwellings","Single-family detached dwellings","Patio homes / zero-lot-line homes","Duplexes","Villa dwellings","Townhouse dwellings","Public parks, golf courses and other recreational facilities","Community residential homes (≤14 residents)","Family child care home","Private recreational facilities"].forEach(u => addPerm("RM-9", u, "permitted"));
    ["Church or place of worship","Public academic institution","Private academic institution","Public and private utilities","Child day care center","Community residential homes (>14 residents)","Lodges, fraternal and service organizations","PUD - Planned Unit Development","Senior housing facility"].forEach(u => addPerm("RM-9", u, "conditional"));
    addPerm("RM-9","All other uses not listed","prohibited");

    ["Multifamily dwellings","Townhouse dwellings","Villa dwellings","Single-family detached dwellings","Duplexes","Patio homes / zero-lot-line homes","Public parks, golf courses and other recreational facilities","Community residential homes (≤14 residents)","Family child care home","Private recreational facilities"].forEach(u => addPerm("RM-12", u, "permitted"));
    ["Church or place of worship","Public academic institution","Private academic institution","Public and private utilities","Child day care center","Community residential homes (>14 residents)","Lodges, fraternal and service organizations","PUD - Planned Unit Development","Senior housing facility"].forEach(u => addPerm("RM-12", u, "conditional"));
    addPerm("RM-12","All other uses not listed","prohibited");

    ["Multifamily dwellings","Townhouse dwellings","Villa dwellings","Single-family detached dwellings","Duplexes","Patio homes / zero-lot-line homes","Public parks, golf courses and other recreational facilities","Community residential homes (≤14 residents)","Family child care home","Private recreational facilities"].forEach(u => addPerm("RM-14", u, "permitted"));
    ["Church or place of worship","Public academic institution","Private academic institution","Public and private utilities","Child day care center","Community residential homes (>14 residents)","Lodges, fraternal and service organizations","PUD - Planned Unit Development","Senior housing facility"].forEach(u => addPerm("RM-14", u, "conditional"));
    addPerm("RM-14","All other uses not listed","prohibited");

    P.filter(p=>p.district_code==="RM-14").forEach(p=> addPerm("RM-18", uses.find(u=>u.slug===p.use_slug).name, p.status, p.notes, p.citations || []));

    [
      "Abstract title and insurers","Accountants and bookkeepers","Actuaries","Advertising / public relations agencies","Aerial survey and photography","Appraisers","Architects","Attorneys","Auditors","Chiropractors","Contractor’s office","Computer services","Counseling, child guidance and family services","Credit reporting","Dentists","Drafting and plan services","Engineers","Financial counseling","Financial institution (without drive-through)","Funeral home (without crematory)","Government offices and facilities","Governmental services","Insurance agencies and adjusters","Interior designer","Investigation agency","Investment / brokerage services","Laser therapy — Aesthetic and/or therapeutic","Manufacturers’ agents","Market research","Messenger and delivery service","Notary public","Opticians","Optometrists","Personal counseling","Physicians","Podiatrists","Public and private utilities","Real estate agencies","Real estate management","Restaurant (without drive-through)","Secretarial services","Stenographers","Surgeons","Tax consultants","Theater ticket agencies","Travel agencies"
    ].forEach(u => addPerm("CO", u, "permitted"));
    [
      "Birthing center","Church or place of worship","Child day care center","Financial institution with drive-through","Living quarters for a residential employee or caretaker in conjunction with permitted principal use","Parking garage","Planned commercial development","Public or private academic institution","Restaurant with drive-through","State licensed massage therapist establishment","Veterinary oncology centers (no overnight stay)"
    ].forEach(u => addPerm("CO", u, "conditional"));
    addPerm("CO","All other uses not listed","prohibited");

    [
      "Abstract title and insurers","Accountants and bookkeepers","Actuaries","Advertising / public relations agencies","Aerial survey and photography","Appraisers","Architects","Attorneys","Auditors","Bakery","Barbershop","Beauty shop","Book or stationery store","Chiropractors","Convenience store","Copying services","Craft shop","Credit reporting","Dentists","Drafting and plan services","Drugstore and/or pharmacy","Dry cleaning facility","Engineers","Financial counseling","Financial institution (without drive-through)","Florist","Gift shop","Government offices and facilities","Governmental services","Hardware store","Health and exercise studio","Hobby shop","Ice cream parlor","Insurance agencies and adjusters","Interior design","Investigation agency","Investment / brokerage services","Jewelry store","Laundromat","Liquor and package store","Locksmith","Manufacturers’ agents","Market research","Music / video shop","Nail salon","Newsstand","Notary public","Optical store","Opticians","Optometrists","Paint store","Personal counseling","Pet grooming","Pet supply store","Photographic supply and camera shop","Physicians","Podiatrists","Public and private utilities","Real estate agencies","Real estate management","Restaurant (without drive-through)","Secretarial services","Shoe repair","Sporting goods store","Stenographers","Surgeons","Tailor / seamstress","Tanning salons","Tax consultants","Theater ticket agencies","Tobacco shop","Travel agencies","Veterinarian’s clinic with boarding","Window treatment store"
    ].forEach(u => addPerm("CN", u, "permitted"));
    [
      "Automobile parts and accessory sales","Car wash (self-service or other)","Child day care center","Financial institution with drive-through","Green market","Living quarters for a residential employee or caretaker in conjunction with permitted principal use","Planned commercial development","Restaurant with drive-through","State licensed massage therapist establishment"
    ].forEach(u => addPerm("CN", u, "conditional"));
    addPerm("CN","All other uses not listed","prohibited");

    [
      "Abstract title and insurers","Accountants and bookkeepers","Actuaries","Adult day care center","Advertising / public relations agencies","Aerial survey and photography","Antique shop","Appliance sales and repair","Appraisers","Architects","Art and graphic supply","Art gallery","Attorneys","Auditors","Automobile alarm/audio sales and installation","Automobile parts and accessory sales","Bakery","Bar or lounge (without live entertainment)","Barbershop","Bath shop","Beauty shop","Bicycle shop","Broadcasting studio","Catalog sales","Catering service","Child day care center","Chiropractors","Clothing store","Computer store","Consignment shop","Contractor’s office","Convenience store","Copying service","Craft shop","Credit reporting","Dentists","Department store","Drugstore or pharmacy","Dry cleaning facility","Electronics sales and facility","Employment / recruitment services","Engineers","Financial counseling","Financial institution (without drive-through)","Florist","Funeral home (without crematory)","Furniture store","Gift shop","Glassware and flatware store","Government offices and facilities","Governmental services","Graphics / drafting service","Grocery store","Hardware store","Health and exercise studio","Hobby shop","Home improvement center","Ice cream parlor","Insurance agencies and adjusters","Interior designer","Investigation agency","Investment / brokerage services","Jewelry store","Laser therapy — Aesthetic and/or therapeutic","Laundromat","Leather goods store","Library","Liquor and package store","Locksmith","Lodges, fraternal and service organizations","Luggage shop","Manufacturers’ agents","Market research","Messenger and delivery service","Movie theater (indoor)","Music / video shop","Nail salons","New and used vehicle sales and service (indoor)","Newsstand","Notary public","Optical store","Opticians","Optometrists","Paint store","Personal counseling","Pet grooming","Pet sales","Pet supply store","Photographic supply and camera shop","Physicians","Podiatrists","Public and private utilities","Real estate agencies","Real estate management","Restaurant (without drive-through)","Secretarial services","Shoe repair","Shoe store","Sporting goods store","Stenographers","Surgeons","Tailor / seamstress","Tanning salons","Tax consultants","Theater ticket agencies","Tobacco shop","Travel agencies","Veterinarian’s clinic with boarding","Window treatment store"
    ].forEach(u => addPerm("CG", u, "permitted"));
    [
      "Amusement arcade","Automobile and/or water craft repair and/or service","Automobile and/or watercraft brokerage","Automobile rental agencies","Automobile window tinting sales and/or installation","Automotive service stations","Bar, lounge or restaurant with live entertainment","Bowling alley","Brewpub (≤6,000 sq ft)","Business, trade or vocational school","Car wash (self-service or other)","Church or place of worship","Drugstore or pharmacy with drive-through","Dry cleaning facility with drive-through","Financial institution with drive-through","Green market","Hotel and/or motel","Integrated care center","Kennels with or without runs","Living quarters for residential employee or caretaker in conjunction with permitted principal use","Microbrewery (≤6,000 sq ft)","New and used vehicle sales (outdoor)","Parking garage","Public and private academic institution","Planned commercial development","Recreational facilities, commercial (outdoor or indoor)","Resort and convention center","Restaurant with drive-through","State licensed massage therapist establishment","Tire sales and installation","Vehicle auction sales","Veterinarian’s clinic with outside run"
    ].forEach(u => addPerm("CG", u, "conditional"));
    addPerm("CG","All other uses not listed","prohibited");

    ["Football, soccer, baseball fields","Handball and racquetball courts","Swimming pools","Tennis clubs","Lawn equipment repair (indoor)","Outdoor commercial recreation facilities","Private golf courses/driving ranges, clubhouses","Private recreation facilities","Public and private utilities"].forEach(u => addPerm("PR", u, "permitted"));
    ["Athletic stadiums","Auditorium","Bowling alley","Cemetery","Government offices and facilities","Governmental services"].forEach(u => addPerm("PR", u, "conditional"));
    addPerm("PR","All other uses not listed","prohibited");

    ["Auditorium","Fire station","Government offices and facilities","Library","Police station","Public parks, golf courses and other recreational facilities","Governmental services","Public academic institution","Public and private utilities","Solid waste transfer stations","Swimming pools","Tennis clubs","Water and wastewater plants"].forEach(u => addPerm("PO", u, "permitted"));
    ["Cemetery","Athletic stadium","Green market","Law enforcement training facilities","Telecommunication towers; antenna"].forEach(u => addPerm("PO", u, "conditional"));
    addPerm("PO","All other uses not listed","prohibited");

    [
      "Assembly, non-profit","Automobile brokerage","Bakery (wholesale)","Boat and RV storage facility","Broadcasting studio","Building supplies facility (retail or wholesale)","Car wash and/or automobile detailing","Catering service and/or food preparation","Contractor's office, shop and accessory retail","Data information processing","Dry cleaning/Laundry service (industrial)","Exterminators","Fire/burglar alarm companies","Fire extinguisher, sales and service","Fitness center","Funeral home without crematory","Government services","Janitorial services","Landscape maintenance service","Lawn equipment repair (indoor)","Living quarters for residential employee or caretaker in conjunction with permitted principal use","Lodges, fraternal and service organizations","Machine or welding shop","Medical marijuana treatment center","Medical or dental laboratory","Monument sales, retail","Motion picture production studio","Office, business or professional","Printing and copying services","Public and private utilities","Research/development center","Restaurant (not fast food type)","School; business, trade, studio or vocational only","Self service storage facility","Transportation facility","Warehouse and storage building","Water or wastewater treatment plant","Wholesale office-warehouse combination","Wholesale, general"
    ].forEach(u => addPerm("IL", u, "permitted"));
    [
      "Adult entertainment establishments","Asphalt or concrete plant","Automobile and/or water craft repair and/or service; service station","Automobile paint and/or body shop","Automobile/truck rental agencies (indoor or outdoor)","Brewpub (≤6,000 sq ft)","Chipping or mulching","Communication cell sites on wheels (COWs)","Convenience store with gas sales","Day labor employment service","Electrical power facilities","Funeral home with crematory","Gas and fuel, wholesale","Hotel and/or motel","Kennels","Manufacturing, limited processing and assembly","Medical research","Memory care facility","Microbrewery (≤6,000 sq ft)","Nursery, retail","Planned industrial development","Recycling, collection station and/or drop off bin","Restaurant, fast food","Small engine repair","Solid waste transfer station","Telecommunication towers, antenna","Towing service and/or storage","Warehouse and storage building over 400,000 sq ft","Water craft brokerage","Vehicle sales and/or rental (indoor and outdoor)"
    ].forEach(u => addPerm("IL", u, "conditional"));
    addPerm("IL","All other uses not listed","prohibited");

    ["All uses listed as 'permitted uses' in the IL zoning district","Automobile/truck rental agency (indoor or outdoor)","Manufacturing, limited processing and assembly","Medical marijuana treatment center","Vehicle sales (indoor)"].forEach(u => addPerm("IG", u, "permitted"));
    [
      "Asphalt or concrete plant","Automobile and/or water craft repair and/or service","Brewery","Fleet vehicle storage and maintenance facility","Funeral home with crematory","Kennels with outside runs","Landscape service and nursery","Medical research","Memory care facility","Microbrewery (≤6,000 sq ft)","Planned industrial development","Senior housing facility","Small engine repair","Solid waste transfer stations","Telecommunication towers, antenna","Water craft brokerage","Park and ride facility","Public or private academic institution"
    ].forEach(u => addPerm("IG", u, "conditional"));
    addPerm("IG","All other uses not listed","prohibited");

    const permResp = await postJSON('/api/permissions/import', { permissions: P });
    log('permissions', permResp?.count || permResp);

    console.log('DONE: Royal Palm Beach seeded.');
  } catch (e) {
    console.error('SEED FAILED:', e.message);
    process.exit(1);
  }
})();
