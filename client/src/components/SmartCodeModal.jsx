// Smart Code Modal — enhanced UI/UX version (Phase A+)

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

  // Load zoning profile when parcel changes
  useEffect(() => {
    if (!parcel || !parcel.jurisdiction || !parcel.zoning) {
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
        console.error("Profile error:", err);
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
      console.error("SmartCode error:", err);
      setAnswer("Error fetching Smart Code response. Please try again or verify the backend service.");
    } finally {
      setLoading(false);
    }
  }

  function handleSuggestedClick(text) {
    setQuestion(text);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full p-4 md:p-5 overflow-y-auto max-h-[90vh]">

        {/* Header */}
        <div className="flex justify-between items-start gap-4 border-b pb-3 mb-4">
          <div className="space-y-1">
            <h2 className="text-lg md:text-xl font-semibold">Smart Code Assistant</h2>
            <p className="text-xs text-gray-500 leading-snug">
              Use this tool to get plain-language guidance on what can be built on this parcel
              and what key zoning standards apply. This is an advisory tool only.
            </p>
          </div>
          <button
            onClick={onClose}
            className="border rounded-full px-3 py-1 text-xs font-medium hover:bg-gray-100"
          >
            Close
          </button>
        </div>

        {/* Parcel Context */}
        <div className="mb-4 text-xs md:text-sm text-gray-700 space-y-1">
          {region && (
            <p>
              <span className="font-semibold">Region:</span> {region}
            </p>
          )}
          {parcel ? (
            <>
              <p>
                <span className="font-semibold">Jurisdiction:</span>{" "}
                {parcel.jurisdiction || "—"}
              </p>
              <p>
                <span className="font-semibold">Zoning District:</span>{" "}
                {parcel.zoning || "—"}
              </p>
              <p>
                <span className="font-semibold">Future Land Use (FLU):</span>{" "}
                {parcel.flu || parcel.fluCategory || "—"}
              </p>
            </>
          ) : (
            <p className="text-gray-500">No parcel selected. Select a parcel on the map first.</p>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">

          {/* Zoning Profile Panel */}
          <div className="border rounded-md bg-gray-50 p-3 space-y-2 text-xs md:text-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm">Zoning Profile</h3>
              {profileLoading && (
                <span className="text-[11px] text-gray-500">Loading…</span>
              )}
            </div>

            {profileError && (
              <p className="text-[11px] text-red-600">{profileError}</p>
            )}

            {!profileLoading && !profile && !profileError && (
              <p className="text-[11px] text-gray-500">
                No saved profile is available for this zoning yet. Smart Code can still answer
                questions using the parcel and zoning context.
              </p>
            )}

            {profile && (
              <div className="space-y-2 text-[11px] md:text-xs text-gray-800">
                {/* Basic info */}
                <div>
                  <p>
                    <span className="font-semibold">Jurisdiction:</span>{" "}
                    {profile.jurisdiction || parcel?.jurisdiction || "—"}
                  </p>
                  <p>
                    <span className="font-semibold">Zoning:</span>{" "}
                    {profile.zoning || parcel?.zoning || "—"}
                  </p>
                  {profile.flu && (
                    <p>
                      <span className="font-semibold">FLU:</span> {profile.flu}
                    </p>
                  )}
                </div>

                {/* Summary */}
                {profile.summary && (
                  <div>
                    <p className="font-semibold">Summary</p>
                    <p className="text-gray-700 mt-0.5">{profile.summary}</p>
                  </div>
                )}

                {/* Typical Uses */}
                {Array.isArray(profile.typicalUses) && profile.typicalUses.length > 0 && (
                  <div>
                    <p className="font-semibold mb-0.5">Typical Uses</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {profile.typicalUses.map((u, i) => (
                        <li key={i}>{u}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Dimensional Standards */}
                {profile.dimensionalSummary && (
                  <div>
                    <p className="font-semibold mb-0.5">Dimensional Standards (Overview)</p>
                    <p className="text-gray-700">
                      {profile.dimensionalSummary}
                    </p>
                  </div>
                )}

                {/* Notes & Disclaimer */}
                {profile.notes && (
                  <div>
                    <p className="font-semibold mb-0.5">Notes</p>
                    <p className="text-gray-700">{profile.notes}</p>
                  </div>
                )}

                {profile.disclaimer && (
                  <p className="text-[10px] text-gray-500">
                    {profile.disclaimer}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Ask Smart Code Panel */}
          <div className="border rounded-md bg-white p-3 flex flex-col space-y-2 text-xs md:text-sm">
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">Ask Smart Code</h3>
              <p className="text-[11px] text-gray-500">
                Ask specific questions about what can be built, key standards, or how this zoning
                applies. Answers are generated based on your parcel and zoning context.
              </p>
            </div>

            {/* Suggested questions */}
            <div className="flex flex-wrap gap-1 mt-1">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSuggestedClick(q)}
                  className="border rounded-full px-2 py-1 text-[11px] hover:bg-gray-100"
                >
                  {q}
                </button>
              ))}
            </div>

            <form onSubmit={askSmartCode} className="space-y-2 mt-2">
              <textarea
                className="w-full border rounded p-2 text-sm min-h-[80px]"
                rows={3}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Example: What are the minimum lot size and setbacks for this zoning district?"
              />

              <div className="flex items-center justify-between gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="border rounded px-3 py-1.5 text-xs md:text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-60"
                >
                  {loading ? "Thinking…" : "Ask Smart Code"}
                </button>
                <p className="text-[10px] text-gray-500">
                  Advisory only. Confirm with official zoning and land development regulations.
                </p>
              </div>
            </form>
          </div>
        </div>

        {/* Answer */}
        {answer && (
          <div className="mt-3 border rounded-md bg-white p-3 text-xs md:text-sm">
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold">AI Guidance (Not Official)</p>
            </div>
            <p className="text-[11px] text-gray-500 mb-1">
              Use this as a planning aid. Always verify with the adopted zoning code and staff.
            </p>
            <div className="mt-1 text-sm whitespace-pre-wrap">
              {answer}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// EOF
