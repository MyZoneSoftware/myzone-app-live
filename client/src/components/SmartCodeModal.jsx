// Smart Code Modal — stable version from MyZone baseline

import React, { useState, useEffect } from "react";

export default function SmartCodeModal({ onClose, context }) {
  const parcel = context?.parcel;
  const region = context?.region;

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Load zoning profile when parcel changes
  useEffect(() => {
    if (!parcel || !parcel.jurisdiction || !parcel.zoning) return;

    const controller = new AbortController();
    async function loadProfile() {
      try {
        setProfileLoading(true);

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

        if (!res.ok) throw new Error("Profile load failed");
        const data = await res.json();
        setProfile(data);
      } catch (err) {
        console.error("Profile error:", err);
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

      if (!res.ok) throw new Error("Smart Code API failed");
      const data = await res.json();
      setAnswer(data.answer || "No answer returned.");
    } catch (err) {
      console.error("SmartCode error:", err);
      setAnswer("Error fetching Smart Code response.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-4 overflow-y-auto max-h-[85vh]">

        {/* Header */}
        <div className="flex justify-between items-center border-b pb-2 mb-3">
          <h2 className="text-lg font-semibold">Smart Code Assistant</h2>
          <button onClick={onClose} className="border rounded px-2 py-1 text-sm">
            Close
          </button>
        </div>

        {/* Parcel Context */}
        <div className="mb-4 text-sm text-gray-700">
          {region && <p><strong>Region:</strong> {region}</p>}
          {parcel ? (
            <>
              <p><strong>Jurisdiction:</strong> {parcel.jurisdiction}</p>
              <p><strong>Zoning:</strong> {parcel.zoning}</p>
              <p><strong>FLU:</strong> {parcel.flu}</p>
            </>
          ) : (
            <p>No parcel selected</p>
          )}
        </div>

        {/* Zoning Profile */}
        <div className="border rounded p-3 bg-gray-50 mb-4">
          <h3 className="font-semibold mb-2 text-sm">Zoning Profile</h3>
          {profileLoading && <p className="text-xs text-gray-500">Loading profile...</p>}
          {profile && (
            <div className="text-xs space-y-1">
              <p><strong>District:</strong> {profile.zoning}</p>
              <p><strong>Summary:</strong> {profile.summary}</p>
              <p><strong>Dimensional:</strong> {profile.dimensionalSummary}</p>
            </div>
          )}
          {!profileLoading && !profile && (
            <p className="text-xs text-gray-500">No profile available.</p>
          )}
        </div>

        {/* Ask Smart Code */}
        <form onSubmit={askSmartCode} className="space-y-2">
          <label className="text-sm font-semibold">Ask a zoning question</label>
          <textarea
            className="w-full border rounded p-2 text-sm"
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Example: What is the max lot coverage?"
          />

          <button
            type="submit"
            disabled={loading}
            className="border rounded px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200"
          >
            {loading ? "Thinking..." : "Ask Smart Code"}
          </button>
        </form>

        {/* Answer */}
        {answer && (
          <div className="mt-4 border rounded p-3 bg-white text-sm">
            <strong>Answer:</strong>
            <p className="whitespace-pre-wrap mt-1">{answer}</p>
          </div>
        )}

      </div>
    </div>
  );
}

// EOF
