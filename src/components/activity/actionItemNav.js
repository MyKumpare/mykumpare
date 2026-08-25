// Shared helper for navigating from an action item back to its parent firm or
// board meeting on the Home page. Home.jsx reads location.state.openFirmId and
// location.state.initialTab to open the firm dialog at the right tab.
export function navigateToFirm(navigate, firmId) {
  if (!firmId) return;
  navigate("/", { state: { openFirmId: firmId } });
}

export function navigateToBoardMeeting(navigate, firmId) {
  if (!firmId) return;
  navigate("/", { state: { openFirmId: firmId, initialTab: "board-meetings" } });
}