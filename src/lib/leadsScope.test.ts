import { describe, expect, it } from "vitest";
import {
  filterLeadsForVendorView,
  isLeadInCeoDelegationPool,
  isLeadVisibleToVendor,
  leadsBranchIdForQuery,
  vendorLeadScopeOrFilter,
} from "./leadsScope";

describe("leadsScope", () => {
  const vendorId = "vendor-1";
  const adminId = "admin-1";

  it("vendedor ve leads asignados a él", () => {
    expect(isLeadVisibleToVendor({ assigned_to: vendorId, created_by: adminId }, vendorId)).toBe(true);
  });

  it("vendedor ve leads propios sin asignar", () => {
    expect(isLeadVisibleToVendor({ assigned_to: null, created_by: vendorId }, vendorId)).toBe(true);
  });

  it("vendedor no ve pool CEO (admin creó en NUEVO sin asignar)", () => {
    expect(isLeadVisibleToVendor({ assigned_to: null, created_by: adminId }, vendorId)).toBe(false);
  });

  it("pool CEO = sin assigned_to", () => {
    expect(isLeadInCeoDelegationPool({ assigned_to: null, created_by: adminId })).toBe(true);
    expect(isLeadInCeoDelegationPool({ assigned_to: vendorId, created_by: adminId })).toBe(false);
  });

  it("filterLeadsForVendorView excluye leads del pool CEO", () => {
    const leads = [
      { id: "1", assigned_to: null, created_by: adminId },
      { id: "2", assigned_to: vendorId, created_by: adminId },
      { id: "3", assigned_to: null, created_by: vendorId },
    ];
    expect(filterLeadsForVendorView(leads, vendorId).map((l) => l.id)).toEqual(["2", "3"]);
  });

  it("vendorLeadScopeOrFilter incluye asignados y propios sin asignar", () => {
    expect(vendorLeadScopeOrFilter(vendorId)).toContain(`assigned_to.eq.${vendorId}`);
    expect(vendorLeadScopeOrFilter(vendorId)).toContain(`created_by.eq.${vendorId}`);
  });

  it("leadsBranchIdForQuery omite sucursal para vendedor", () => {
    expect(leadsBranchIdForQuery("vendedor", "branch-1")).toBeUndefined();
    expect(leadsBranchIdForQuery("admin", "branch-1")).toBe("branch-1");
  });
});
