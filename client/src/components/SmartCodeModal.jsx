// Smart Code Modal — enhanced UI/UX with clearer Left/Right separation + formatted AI answer

import React, { useState, useEffect } from "react";

const SUGGESTED_QUESTIONS = [
  "What can I build by right on this parcel under this zoning?",
  "What are the minimum lot size and width requirements for this zoning district?",
  "What are the front, side, and rear setbacks and the maximum building height?",
  "Are there any special conditions or limitations I should know about for this zoning?"
];

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
            flu: parcel.flu
          }),
          signal: controller.signal
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
        body: JSON.stringify({ question, context })
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

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full p-4 md:p-6 overflow-y-auto max-h-[90vh]">

        {/* Header */}
        <div className="flex justify-between items-start gap-4 border-b pb-3 mb-4">
          <div>
            <h2 className="text-xl font-semibold">Smart Code Assistant</h2>
            <p className="text-xs text-gray-500 mt-1">
              Advisory planning assistant. Always verify with official zoning &amp; land development regulations.
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
          {region && (
            <p><span className="font-semibold">Region:</span> {region}</p>
          )}
          {parcel ? (
            <>
              <p><span className="font-semibold">Jurisdiction:</span> {parcel.jurisdiction}</p>
              <p><span className="font-semibold">Zoning District:</span> {parcel.zoning}</p>
              <p><span className="font-semibold">Future Land Use:</span> {parcel.flu || parcel.fluCategory || "—"}</p>
            </>
          ) : (
            <p className="text-gray-500">No parcel selected.</p>
          )}
        </div>

        {/* Side-by-Side Panels */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* LEFT PANEL — ZONING PROFILE */}
          <div className="border-2 border-gray-200 rounded-md bg-gray-50 p-4 shadow-sm">
            <h3 className="text-base font-semibold mb-2 border-b pb-1">📘 Zoning Profile</h3>

            {profileLoading && <p className="text-xs text-gray-500">Loading…</p>}
            {profileError && <p className="text-xs text-red-600">{profileError}</p>}

            {!profile && !profileLoading && !profileError && (
              <p className="text-xs text-gray-500">
                No saved profile available. Smart Code can still answer questions using this parcel and zoning context.
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

                {/* DIMENSIONAL */}
                {profile.dimensionalSummary && (
                  <div>
                    <p className="font-semibold mb-1">Dimensional Standards (Overview)</p>
                    <p className="text-justify">{profile.dimensionalSummary}</p>
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

          {/* RIGHT PANEL — ASK SMART CODE */}
          <div className="border-2 border-blue-200 rounded-md bg-blue-50 p-4 shadow-sm">
            <h3 className="text-base font-semibold mb-2 border-b pb-1">💬 Ask Smart Code</h3>

            {/* Suggested questions */}
            <div className="flex flex-wrap gap-1 mb-3">
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

              <p className="text-[10px] text-blue-700 mt-1">
                Advisory tool — verify all results with adopted zoning code &amp; staff.
              </p>
            </form>
          </div>
        </div>

        {/* AI ANSWER */}
        {answer && (
          <div className="mt-4 border rounded-md bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-sm">AI Guidance (Not Official)</h3>
            <p className="text-[11px] text-gray-500 mb-2">
              Use as a planning aid — always confirm with official LDRs and staff.
            </p>

            {/* If multiple lines, show as bullets; otherwise as a justified paragraph */}
            {formattedAnswerLines.length > 1 ? (
              <ul className="list-disc pl-5 space-y-1 text-sm text-justify">
                {formattedAnswerLines.map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm whitespace-pre-wrap text-justify">
                {answer}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// EOF
