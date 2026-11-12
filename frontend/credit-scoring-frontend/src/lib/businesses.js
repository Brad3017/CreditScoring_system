// An owner's assessments can belong to different businesses (one business = one KRA PIN).
// value: "all" or a business id as a string (see components/BusinessFilter.jsx).
export function matchesBusiness(assessment, value) {
  return value === "all" || String(assessment.business_id) === value;
}
