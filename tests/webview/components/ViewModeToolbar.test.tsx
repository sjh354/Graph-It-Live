// @vitest-environment happy-dom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ViewModeToolbar } from "@/webview/components/ViewModeToolbar";

afterEach(cleanup);

describe("ViewModeToolbar", () => {
  it("marks the current mode", () => {
    render(<ViewModeToolbar mode="symbol" onSelect={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Symbols" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Graph" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("offers every mode the extension can render", () => {
    render(<ViewModeToolbar mode="file" onSelect={vi.fn()} />);

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Graph",
      "List",
      "Symbols",
      "Architecture",
      "Call graph",
    ]);
  });

  it("reports the chosen mode", () => {
    const onSelect = vi.fn();
    render(<ViewModeToolbar mode="file" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Call graph" }));

    expect(onSelect).toHaveBeenCalledWith("callgraph");
  });
});
