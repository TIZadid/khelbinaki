import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Link, matchPostPath, usePath } from "./router";

afterEach(() => window.history.pushState(null, "", "/"));

function Where() {
  return <p data-testid="path">{usePath()}</p>;
}

describe("matchPostPath", () => {
  it("extracts the post id", () => {
    expect(matchPostPath("/p/aB3dE9xK2q")).toBe("aB3dE9xK2q");
    expect(matchPostPath("/p/aB3dE9xK2q/")).toBe("aB3dE9xK2q");
  });

  it("ignores other paths", () => {
    expect(matchPostPath("/")).toBeNull();
    expect(matchPostPath("/p/")).toBeNull();
    expect(matchPostPath("/p/a/b")).toBeNull();
    expect(matchPostPath("/p/has space")).toBeNull();
  });
});

describe("Link", () => {
  it("navigates in-app on a plain click", () => {
    render(
      <>
        <Link to="/p/abc">go</Link>
        <Where />
      </>,
    );
    const notPrevented = fireEvent.click(screen.getByRole("link", { name: "go" }));
    expect(notPrevented).toBe(false);
    expect(screen.getByTestId("path")).toHaveTextContent("/p/abc");
  });

  it("lets modified clicks through to the browser", () => {
    render(
      <>
        <Link to="/p/abc">go</Link>
        <Where />
      </>,
    );
    expect(fireEvent.click(screen.getByRole("link", { name: "go" }), { ctrlKey: true })).toBe(true);
    expect(screen.getByTestId("path")).toHaveTextContent(/^\/$/);
  });
});
