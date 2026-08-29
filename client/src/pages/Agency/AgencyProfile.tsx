import React from 'react';
import ProfileSection from "@/components/sections/ProfileSection";

// Agency-side "My Profile" — same combined Account Details / Password /
// Notifications & Preferences component used on the Workspace side. The
// backend endpoints it calls (/api/users/me, /api/users/preferences, etc.)
// are scoped to the logged-in user via the JWT, not the workspace, so the
// same component works unchanged here. No extra background/max-width
// wrapper — matches the Workspace settings pane's flat, full-width p-4
// layout instead of centering in its own narrower page shell.
const AgencyProfile: React.FC = () => {
  return (
    <div className="h-screen overflow-auto p-4">
      <ProfileSection context="agency" />
    </div>
  );
};

export default AgencyProfile;
