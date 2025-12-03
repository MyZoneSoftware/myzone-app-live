import React from 'react';

export default function PancakeMenu({
  open,
  onClose,
  onOpenApplications,
  onOpenMap,
  onOpenZoningTools,
  onOpenReports,
  onOpenFeasibility,
  onOpenSelectCities
}) {
  if (!open) return null;
  return (
    <div className="mz-drawer" role="dialog" aria-modal="true">
      <div className="mz-dim" onClick={onClose} />
      <aside className="mz-drawer-panel">
        <div className="mz-drawer-head">
          <div className="mz-drawer-title">Menu</div>
          <button className="mz-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <ul className="mz-drawer-list">
          <li onClick={onOpenApplications}>Applications</li>
          <li onClick={onOpenMap}>Map Tools</li>
          <li onClick={onOpenZoningTools}>Zoning Tools</li>
          <li onClick={onOpenReports}>Reports</li>
          <li onClick={onOpenFeasibility}>Feasibility</li>
          <li onClick={onOpenSelectCities}>Select City</li>
        </ul>
      </aside>
    </div>
  );
}
