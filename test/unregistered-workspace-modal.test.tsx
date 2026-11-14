// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://dex.support.servicev8.com/?signin=1"}
import React,{act} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach,beforeEach,describe,it,expect,vi} from "vitest";
import {SignInModal} from "../src/components/SignInModal";
let root:Root,box:HTMLDivElement;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;box=document.createElement("div");document.body.appendChild(box);root=createRoot(box);});
afterEach(()=>{act(()=>root.unmount());box.remove();vi.unstubAllGlobals();});
async function mount(open=true){await act(async()=>{root.render(<SignInModal isOpen={open} onClose={()=>{}} onSuccess={()=>{}} onOpenSignup={()=>{}}/>);});}
function noCredentials(){expect(box.querySelector('input[type="password"]')).toBeNull();expect(box.querySelector('input[type="email"]')).toBeNull();expect(box.textContent).not.toContain("Welcome to Dex");}
describe("unknown tenant never presents login fields",()=>{
 it("revalidates after reopening and never reuses a previous successful lookup",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>Response.json({success:true,slug:"dex",name:"Verified Research Ltd",redirectUrl:"https://dex.support.servicev8.com/"})));
  await mount();expect(box.querySelector('input[type="password"]')).not.toBeNull();await mount(false);
  vi.stubGlobal("fetch",vi.fn(()=>new Promise(()=>{})));await mount();noCredentials();
 });
 it("has no credential flash while registration lookup is pending",async()=>{
  vi.stubGlobal("fetch",vi.fn(()=>new Promise(()=>{})));await mount();noCredentials();expect(box.textContent).toContain("Verifying workspace");
 });
 it.each([404,503])("hides fields on lookup status %s",async(status)=>{
  vi.stubGlobal("fetch",vi.fn(async()=>new Response(null,{status})));await mount();noCredentials();expect(box.textContent).toContain(status===404?"Workspace not found":"Workspace verification unavailable");
 });
 it("rejects mismatched origin even with a matching slug",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>Response.json({success:true,slug:"dex",name:"Forged Name",redirectUrl:"https://other.support.servicev8.com/"})));await mount();noCredentials();
 });
 it("reveals fields only after current exact registration and uses canonical company name",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>Response.json({success:true,slug:"dex",name:"Verified Research Ltd",redirectUrl:"https://dex.support.servicev8.com/"})));await mount();expect(box.querySelector('input[type="password"]')).not.toBeNull();expect(box.textContent).toContain("Welcome to Verified Research Ltd");
 });
});
