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

  it("leadsBranchIdForQuery: vendedor y admin/jefe_jefe ven todo el tenant; el resto su sucursal", () => {
    expect(leadsBranchIdForQuery("vendedor", "branch-1")).toBeUndefined();
    // admin y jefe_jefe ven todo el tenant (Vista global): sin filtro de sucursal.
    expect(leadsBranchIdForQuery("admin", "branch-1")).toBeUndefined();
    expect(leadsBranchIdForQuery("jefe_jefe", "branch-1")).toBeUndefined();
    // jefaturas de sucursal / gerencia / finanzas siguen scopeadas a su sucursal.
    expect(leadsBranchIdForQuery("jefe_sucursal", "branch-1")).toBe("branch-1");
    expect(leadsBranchIdForQuery("gerente", "branch-1")).toBe("branch-1");
  });
});
