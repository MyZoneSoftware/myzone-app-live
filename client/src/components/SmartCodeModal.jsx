// Smart Code Modal — jurisdiction theming, dimensional table, print summary, AI answer in right panel

import React, { useState, useEffect } from "react";

const SUGGESTED_QUESTIONS = [
  "What can I build by right on this parcel under this zoning?",
  "What are the minimum lot size and width requirements for this zoning district?",
  "What are the front, side, and rear setbacks and the maximum building height?",
  "Are there any special conditions or limitations I should know about for this zoning?"
];

// Simple jurisdiction-based theming for visuals
function getJurisdictionTheme(jurisdiction = "") {
  const j = jurisdiction.toLowerCase();

  // Example: Village of Royal Palm Beach theme
  if (j.includes("royal palm beach")) {
    return {
      icon: "🏡",
      badgeLabel: "Village of Royal Palm Beach",
      badgeClass:
        "inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800",
      leftBorder: "border-emerald-200",
      leftBg: "bg-emerald-50",
      rightBorder: "border-emerald-200",
      rightBg: "bg-emerald-50/70",
    };
  }

  // Default generic jurisdiction theme
  return {
    icon: "🏙️",
    badgeLabel: jurisdiction || "Local Jurisdiction",
    badgeClass:
      "inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-800",
    leftBorder: "border-gray-200",
    leftBg: "bg-gray-50",
    rightBorder: "border-blue-200",
    rightBg: "bg-blue-50",
  };
}

export default function SmartCodeModal({ onClose, context }) {
  const parcel = context?.parcel;
  const region = context?.region;

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Derive formatted lines for AI answer (for bullets + justified text)
  const formattedAnswerLines = answer
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const theme = getJurisdictionTheme(
    profile?.jurisdiction || parcel?.jurisdiction || ""
  );

  // Load zoning profile when parcel changes
  useEffect(() => {
    if (!parcel?.jurisdiction || !parcel?.zoning) {
      setProfile(null);
      setProfileError("");
      setProfileLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadProfile() {
      try {
        setProfileLoading(true);
        setProfileError("");

        const res = await fetch("http://localhost:5003/api/jurisdiction-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jurisdiction: parcel.jurisdiction,
            zoning: parcel.zoning,
            flu: parcel.flu,
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`Profile load failed (${res.status})`);

        const data = await res.json();
        setProfile(data);
      } catch (err) {
        if (err.name === "AbortError") return;
        setProfile(null);
        setProfileError("Unable to load zoning profile for this parcel.");
      } finally {
        setProfileLoading(false);
      }
    }

    loadProfile();
    return () => controller.abort();
  }, [parcel]);

  async function askSmartCode(e) {
    e.preventDefault();
    if (!question.trim()) return;

    try {
      setLoading(true);
      setAnswer("");

      const res = await fetch("http://localhost:5003/api/smart-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context }),
      });

      if (!res.ok) throw new Error(`Smart Code API failed (${res.status})`);

      const data = await res.json();
      setAnswer(data.answer || "No answer returned.");
    } catch (err) {
      setAnswer("Error fetching Smart Code response. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSuggestedClick(text) {
    setQuestion(text);
  }

  // Build HTML for print-friendly zoning summary
  function handlePrintSummary() {
    if (!parcel && !profile) {
      alert("No zoning profile or parcel context available to print.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      alert("Pop-up blocked. Please allow pop-ups for this site to print.");
      return;
    }

    const dimRows = [];

    if (profile?.minLotSize) dimRows.push(["Minimum Lot Size", profile.minLotSize]);
    if (profile?.minLotWidth) dimRows.push(["Minimum Lot Width", profile.minLotWidth]);
    if (profile?.frontSetback) dimRows.push(["Front Setback", profile.frontSetback]);
    if (profile?.sideSetback) dimRows.push(["Side Setback", profile.sideSetback]);
    if (profile?.rearSetback) dimRows.push(["Rear Setback", profile.rearSetback]);
    if (profile?.maxHeight) dimRows.push(["Maximum Building Height", profile.maxHeight]);
    if (profile?.maxLotCoverage)
      dimRows.push(["Maximum Lot Coverage", profile.maxLotCoverage]);
    if (profile?.parkingSummary)
      dimRows.push(["Parking Summary", profile.parkingSummary]);

    let dimRowsHtml = "";
    if (dimRows.length > 0) {
      dimRows.forEach(([label, value]) => {
        dimRowsHtml += `<tr><th>${label}</th><td>${value}</td></tr>`;
      });
    } else if (profile?.dimensionalSummary) {
      dimRowsHtml += `<tr><th>Overview</th><td>${profile.dimensionalSummary}</td></tr>`;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Zoning Summary - ${parcel?.zoning || ""}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, -seg oe ui, sans-serif;
      padding: 24px;
      line-height: 1.5;
      color: #111827;
      font-size: 14px;
    }
    h1 {
      font-size: 20px;
      margin-bottom: 4px;
    }
    h2 {
      font-size: 16px;
      margin-top: 18px;
      margin-bottom: 6px;
    }
    h3 {
      font-size: 14px;
      margin-top: 14px;
      margin-bottom: 4px;
    }
    .meta {
      font-size: 12px;
      color: #4b5563;
      margin-bottom: 12px;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin-top: 8px;
      font-size: 13px;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f3f4f6;
      width: 40%;
    }
    .muted {
      color: #6b7280;
      font-size: 11px;
      margin-top: 18px;
    }
  </style>
</head>
<body>
  <h1>Zoning Summary</h1>
  <div class="meta">
    <div><strong>Jurisdiction:</strong> ${profile?.jurisdiction || parcel?.jurisdiction || ""}</div>
    <div><strong>Zoning District:</strong> ${profile?.zoning || parcel?.zoning || ""}</div>
    <div><strong>Future Land Use:</strong> ${parcel?.flu || parcel?.fluCategory || profile?.flu || ""}</div>
  </div>

  ${
    profile?.summary
      ? `<h2>Summary</h2><p>${profile.summary}</p>`
      : ""
  }

  ${
    profile?.typicalUses && Array.isArray(profile.typicalUses)
      ? `<h2>Typical Uses</h2><ul>${profile.typicalUses
          .map((u) => `<li>${u}</li>`)
          .join("")}</ul>`
      : ""
  }

  ${
    dimRowsHtml
      ? `<h2>Dimensional Standards</h2><table>${dimRowsHtml}</table>`
      : ""
  }

  ${
    profile?.notes
      ? `<h2>Notes</h2><p>${profile.notes}</p>`
      : ""
  }

  <p class="muted">
    This zoning summary is advisory. Always verify with the adopted zoning & land development regulations
    and speak with planning staff for formal interpretations or approvals.
  </p>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full p-4 md:p-6 overflow-y-auto max-h-[90vh]">

        {/* Header */}
        <div className="flex justify-between items-start gap-4 border-b pb-3 mb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">{theme.icon}</span>
              <h2 className="text-xl font-semibold">Smart Code Assistant</h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={theme.badgeClass}>{theme.badgeLabel}</span>
              {region && (
                <span className="inline-flex items-center rounded-full border border-gray-300 bg-gray-50 px-2.5 py-0.5 text-[11px] text-gray-700">
                  Region: {region}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Advisory planning tool. Always verify with official zoning &amp; LDRs and staff.
            </p>
          </div>
          <button
            onClick={onClose}
            className="border rounded-full px-3 py-1 text-xs hover:bg-gray-100"
          >
            Close
          </button>
        </div>

        {/* Parcel Key Details */}
        <div className="mb-4 text-xs text-gray-700 space-y-1">
          {parcel ? (
            <>
              <p>
                <span className="font-semibold">Jurisdiction:</span> {parcel.jurisdiction}
              </p>
              <p>
                <span className="font-semibold">Zoning District:</span> {parcel.zoning}
              </p>
              <p>
                <span className="font-semibold">Future Land Use:</span>{" "}
                {parcel.flu || parcel.fluCategory || "—"}
              </p>
            </>
          ) : (
            <p className="text-gray-500">No parcel selected.</p>
          )}
        </div>

        {/* Side-by-Side Panels */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* LEFT PANEL — ZONING PROFILE */}
          <div
            className={`border-2 rounded-md p-4 shadow-sm ${theme.leftBorder} ${theme.leftBg}`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-base font-semibold border-b pb-1">📘 Zoning Profile</h3>
              <button
                type="button"
                onClick={handlePrintSummary}
                className="border rounded px-2 py-1 text-[11px] bg-white/70 hover:bg-white"
              >
                Print Summary
              </button>
            </div>

            {profileLoading && <p className="text-xs text-gray-500">Loading…</p>}
            {profileError && <p className="text-xs text-red-600">{profileError}</p>}

            {!profile && !profileLoading && !profileError && (
              <p className="text-xs text-gray-500">
                No saved profile available. Smart Code can still answer questions using this parcel
                and zoning context.
              </p>
            )}

            {profile && (
              <div className="space-y-3 text-xs text-gray-800 mt-2">
                {/* SUMMARY */}
                {profile.summary && (
                  <div>
                    <p className="font-semibold mb-1">Summary</p>
                    <p className="text-justify">{profile.summary}</p>
                  </div>
                )}

                {/* TYPICAL USES */}
                {Array.isArray(profile.typicalUses) && profile.typicalUses.length > 0 && (
                  <div>
                    <p className="font-semibold mb-1">Typical Uses</p>
                    <ul className="list-disc pl-5 space-y-0.5">
                      {profile.typicalUses.map((u, i) => (
                        <li key={i}>{u}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* DIMENSIONAL / SETBACK TABLE (if structured fields exist) */}
                {(profile.minLotSize ||
                  profile.minLotWidth ||
                  profile.frontSetback ||
                  profile.sideSetback ||
                  profile.rearSetback ||
                  profile.maxHeight ||
                  profile.maxLotCoverage ||
                  profile.parkingSummary ||
                  profile.dimensionalSummary) && (
                  <div>
                    <p className="font-semibold mb-1">Dimensional Standards</p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse text-[11px]">
                        <tbody>
                          {profile.minLotSize && (
                            <tr>
                              <th className="border border-gray-200 bg-gray-100 px-2 py-1 text-left font-semibold">
                                Minimum Lot Size
                              </th>
                              <td className="border border-gray-200 px-2 py-1">
                                {profile.minLotSize}
                              </td>
                            </tr>
                          )}
                          {profile.minLotWidth && (
                            <tr>
                              <th className="border border-gray-200 bg-gray-100 px-2 py-1 text-left font-semibold">
                                Minimum Lot Width
                              </th>
                              <td className="border border-gray-200 px-2 py-1">
                                {profile.minLotWidth}
                              </td>
                            </tr>
                          )}
                          {profile.frontSetback && (
                            <tr>
                              <th className="border border-gray-200 bg-gray-100 px-2 py-1 text-left font-semibold">
                                Front Setback
                              </th>
                              <td className="border border-gray-200 px-2 py-1">
                                {profile.frontSetback}
                              </td>
                            </tr>
                          )}
                          {profile.sideSetback && (
                            <tr>
                              <th className="border border-gray-200 bg-gray-100 px-2 py-1 text-left font-semibold">
                                Side Setback
                              </th>
                              <td className="border border-gray-200 px-2 py-1">
                                {profile.sideSetback}
                              </td>
                            </tr>
                          )}
                          {profile.rearSetback && (
                            <tr>
                              <th className="border border-gray-200 bg-gray-100 px-2 py-1 text-left font-semibold">
                                Rear Setback
                              </th>
                              <td className="border border-gray-200 px-2 py-1">
                                {profile.rearSetback}
                              </td>
                            </tr>
                          )}
                          {profile.maxHeight && (
                            <tr>
                              <th className="border border-gray-200 bg-gray-100 px-2 py-1 text-left font-semibold">
                                Maximum Building Height
                              </th>
                              <td className="border border-gray-200 px-2 py-1">
                                {profile.maxHeight}
                              </td>
                            </tr>
                          )}
                          {profile.maxLotCoverage && (
                            <tr>
                              <th className="border border-gray-200 bg-gray-100 px-2 py-1 text-left font-semibold">
                                Maximum Lot Coverage
                              </th>
                              <td className="border border-gray-200 px-2 py-1">
                                {profile.maxLotCoverage}
                              </td>
                            </tr>
                          )}
                          {profile.parkingSummary && (
                            <tr>
                              <th className="border border-gray-200 bg-gray-100 px-2 py-1 text-left font-semibold">
                                Parking Summary
                              </th>
                              <td className="border border-gray-200 px-2 py-1">
                                {profile.parkingSummary}
                              </td>
                            </tr>
                          )}

                          {/* If no structured fields but a dimensional summary exists */}
                          {!(
                            profile.minLotSize ||
                            profile.minLotWidth ||
                            profile.frontSetback ||
                            profile.sideSetback ||
                            profile.rearSetback ||
                            profile.maxHeight ||
                            profile.maxLotCoverage ||
                            profile.parkingSummary
                          ) &&
                            profile.dimensionalSummary && (
                              <tr>
                                <th className="border border-gray-200 bg-gray-100 px-2 py-1 text-left font-semibold">
                                  Overview
                                </th>
                                <td className="border border-gray-200 px-2 py-1">
                                  {profile.dimensionalSummary}
                                </td>
                              </tr>
                            )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* NOTES */}
                {profile.notes && (
                  <div>
                    <p className="font-semibold mb-1">Notes</p>
                    <p className="text-justify">{profile.notes}</p>
                  </div>
                )}

                {/* DISCLAIMER */}
                {profile.disclaimer && (
                  <p className="text-[10px] text-gray-500 border-t pt-2">
                    {profile.disclaimer}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* RIGHT PANEL — ASK SMART CODE + AI ANSWER */}
          <div
            className={`border-2 rounded-md p-4 shadow-sm flex flex-col gap-3 ${theme.rightBorder} ${theme.rightBg}`}
          >
            <h3 className="text-base font-semibold mb-1 border-b pb-1">💬 Ask Smart Code</h3>

            {/* Suggested questions */}
            <div className="flex flex-wrap gap-1">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="border rounded-full px-2 py-1 text-[11px] bg-white hover:bg-gray-100"
                  onClick={() => handleSuggestedClick(q)}
                >
                  {q}
                </button>
              ))}
            </div>

            <form onSubmit={askSmartCode} className="space-y-2">
              <textarea
                className="w-full border rounded p-2 text-sm min-h-[90px]"
                placeholder="Example: What are the minimum lot size and setbacks for this zoning district?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />

              <button
                type="submit"
                disabled={loading}
                className="border rounded px-3 py-1.5 text-sm bg-white hover:bg-gray-100 disabled:opacity-60"
              >
                {loading ? "Thinking…" : "Ask Smart Code"}
              </button>

              <p className="text-[10px] text-blue-800 mt-1">
                AI guidance only — confirm with adopted code, zoning map, and staff.
              </p>
            </form>

            {/* AI ANSWER — now INSIDE the right panel */}
            {answer && (
              <div className="mt-2 border rounded-md bg-white p-3 shadow-inner">
                <h4 className="font-semibold text-xs mb-1">AI Guidance (Not Official)</h4>
                <p className="text-[11px] text-gray-500 mb-2">
                  Use as a planning aid — always confirm with official LDRs and staff.
                </p>

                {formattedAnswerLines.length > 1 ? (
                  <ul className="list-disc pl-5 space-y-1 text-sm text-justify">
                    {formattedAnswerLines.map((line, idx) => (
                      <li key={idx}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm whitespace-pre-wrap text-justify">{answer}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// EOF
