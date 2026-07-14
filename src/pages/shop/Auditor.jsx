import React from 'react';
import Owner from './Owner.jsx';

/**
 * Auditor Dashboard
 * 
 * This component securely wraps the Owner dashboard for the Auditor role.
 * Role-based access control inside Owner.jsx ensures that action-oriented
 * features (Add, Edit, Delete, Refund) are disabled because the ownerAccess 
 * and managerAccess flags evaluate to false for Auditors.
 * 
 * Additionally, getDashboardLabel inside roles.js automatically identifies 
 * the role and updates the header text to "Auditor Dashboard".
 */
export default function Auditor() {
  return <Owner />;
}
