// Append-only merge of CSV firm data into an existing firm record.
// Only fills fields that are empty on the existing record; firm_types is
// unioned (additive). Ported from the frontend CsvFirmImport helper so the
// server-side import job can apply the same merge semantics.
export function buildCsvMergeUpdates(existingFirm: any, csvFirm: any): Record<string, any> {
  const updates: Record<string, any> = {};
  const fillIfEmpty = (field: string) => {
    if (csvFirm[field] && !existingFirm[field]) updates[field] = csvFirm[field];
  };
  fillIfEmpty("logo_url");
  fillIfEmpty("website");
  fillIfEmpty("linkedin_url");
  fillIfEmpty("email");
  fillIfEmpty("description");
  if (csvFirm.year_founded && !existingFirm.year_founded) updates.year_founded = csvFirm.year_founded;
  if (csvFirm.firm_type && !existingFirm.firm_type) {
    updates.firm_type = csvFirm.firm_type;
  }
  if (csvFirm.allocator_types && csvFirm.allocator_types.length > 0) {
    const existing = existingFirm.allocator_types || [];
    const mergedAlloc = [...new Set([...existing, ...csvFirm.allocator_types])];
    if (mergedAlloc.length > existing.length) updates.allocator_types = mergedAlloc;
  }
  return updates;
}