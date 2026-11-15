vi.mock("@/lib/auth/workspace-discovery-limit",()=>({workspaceDiscoveryLimiter:{enforce:vi.fn(async()=>{})}}));
import React from "react";
import {WorkspaceLookupError} from "../src/lib/tenant-resolver";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,it,expect,vi,afterEach} from "vitest";
const fixture=vi.hoisted(()=>({headers:vi.fn(),lookup:vi.fn()}));
vi.mock("next/headers",()=>({headers:fixture.headers}));
vi.mock("next/navigation",()=>({redirect:(path:string)=>{throw Error("NEXT_REDIRECT:"+path);}}));
vi.mock("@/lib/auth/workspace-discovery",()=>({discoverWorkspace:fixture.lookup}));
import RootLayout from "../src/app/layout";
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
describe("server root layout gates all tenant pages",()=>{
 async function page(){vi.stubGlobal("React",React);fixture.headers.mockResolvedValue(new Headers({host:"dex.support.servicev8.com"}));return RootLayout({children:<form><input type="password"/><p>Protected child</p></form>});}
 it("unknown registration returns not-found before credential children",async()=>{fixture.lookup.mockResolvedValue(null);await expect(page()).rejects.toThrow("/workspace-not-found");});
 it("directory outage never renders child credentials",async()=>{fixture.lookup.mockRejectedValue(Error("down"));await expect(page()).rejects.toThrow("/workspace-unavailable");});
 it("owner-verification hold redirects before rendering credential children",async()=>{fixture.lookup.mockRejectedValue(new WorkspaceLookupError("Owner verification required","workspace_owner_verification_required",409));await expect(page()).rejects.toThrow("/workspace-verification-required");});
 it("registered tenant can render its page",async()=>{fixture.lookup.mockResolvedValue({id:"canonical",accountId:"account",slug:"dex",name:"Actual Company",status:"active",url:"https://dex.support.servicev8.com/"});expect(renderToStaticMarkup(await page())).toContain('type="password"');});
});
