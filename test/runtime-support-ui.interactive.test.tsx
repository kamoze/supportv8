// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { FocusedWorkspaceView } from "@/components/views/FocusedWorkspaceView";
import { RuntimeWorkspace } from "@/app/runtime/runtime-workspace";

const ticket={id:"runtime-1",ticketRef:"SV8-RUNTIME-1",customerRef:"customer-synthetic",customerName:"Synthetic Customer",summary:"Synthetic request",status:"open",priority:"normal",source:"runtime_manual",createdAt:"2026-09-16T10:00:00Z",updatedAt:"2026-09-16T11:00:00Z"};
const roots:Root[]=[];
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
afterEach(()=>{for(const root of roots)act(()=>root.unmount());roots.length=0;document.body.innerHTML="";});
function props(canManage:boolean,onCreate=vi.fn(async()=>{}),onUpdate=vi.fn(async()=>{})){return {runtimeTransport:{tickets:[ticket],selected:ticket,canManage,onCreate,onUpdate}};}
function click(label:string){const button=[...document.querySelectorAll("button")].find(node=>node.textContent===label);expect(button).toBeTruthy();act(()=>button!.dispatchEvent(new MouseEvent("click",{bubbles:true})));}

describe("Runtime Work Desk mounted capability behavior",()=>{
  it("renders the last item and pagination inside the bounded scroll surface",()=>{
    const tickets=Array.from({length:30},(_,index)=>({...ticket,id:`runtime-${index+1}`,ticketRef:`SV8-RUNTIME-${index+1}`,customerName:`Customer ${index+1}`}));
    const container=document.createElement("div");document.body.append(container);const root=createRoot(container);roots.push(root);
    act(()=>root.render(<RuntimeWorkspace domain="synthetic-support" state="ready" page={{tickets,nextCursor:"next-page"}} selected={tickets[0]}/>));
    const scroll=container.querySelector(".runtime-ticket-scroll");
    expect(scroll).toBeTruthy();
    expect(scroll?.textContent).toContain("Customer 30");
    expect(scroll?.querySelector<HTMLAnchorElement>(".runtime-next")?.href).toContain("cursor=next-page");
  });

  it("opens and closes the mobile native navigation with Escape",()=>{
    const container=document.createElement("div");document.body.append(container);const root=createRoot(container);roots.push(root);
    act(()=>root.render(<RuntimeWorkspace domain="synthetic-support" state="empty" page={{tickets:[]}}/>));
    const open=container.querySelector<HTMLButtonElement>('button[aria-label="Open navigation"]');
    expect(open).toBeTruthy();
    open!.focus();
    act(()=>open!.dispatchEvent(new MouseEvent("click",{bubbles:true})));
    expect(container.querySelector("#support-navigation")?.getAttribute("data-mobile-open")).toBe("true");
    act(()=>document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true})));
    expect(container.querySelector("#support-navigation")?.getAttribute("data-mobile-open")).toBe("false");
    expect(document.activeElement).toBe(container.querySelector("#support-workspace"));
  });
  it("clears open Create and Edit forms when current access rerenders read-only",()=>{
    const container=document.createElement("div");document.body.append(container);const root=createRoot(container);roots.push(root);
    const onCreate=vi.fn(async()=>{}),onUpdate=vi.fn(async()=>{});
    act(()=>root.render(<FocusedWorkspaceView {...props(true,onCreate,onUpdate)}/>));
    click("Create ticket");expect(document.querySelector('input[name="customerName"]')).toBeTruthy();const staleCreate=document.querySelector("form.runtime-form")!;
    act(()=>root.render(<FocusedWorkspaceView {...props(false,onCreate,onUpdate)}/>));
    expect(document.querySelector('input[name="customerName"]')).toBeNull();expect(document.body.textContent).not.toContain("Save ticket");act(()=>staleCreate.dispatchEvent(new SubmitEvent("submit",{bubbles:true,cancelable:true})));
    act(()=>root.render(<FocusedWorkspaceView {...props(true,onCreate,onUpdate)}/>));
    expect(document.querySelector('input[name="customerName"]')).toBeNull();click("Edit ticket");expect(document.body.textContent).toContain("Save changes");const staleEdit=document.querySelector("form.runtime-form")!;
    act(()=>root.render(<FocusedWorkspaceView {...props(false,onCreate,onUpdate)}/>));
    expect(document.body.textContent).not.toContain("Save changes");act(()=>staleEdit.dispatchEvent(new SubmitEvent("submit",{bubbles:true,cancelable:true})));expect(onCreate).not.toHaveBeenCalled();expect(onUpdate).not.toHaveBeenCalled();
  });

  it("shows a rejected persisted mutation as visible inline status",async()=>{
    const container=document.createElement("div");document.body.append(container);const root=createRoot(container);roots.push(root);
    const onCreate=vi.fn(async()=>{throw new Error("Current access is read only. Reopen Support from Runtime.");});
    act(()=>root.render(<FocusedWorkspaceView {...props(true,onCreate)}/>));click("Create ticket");
    const name=document.querySelector('input[name="customerName"]') as HTMLInputElement,summary=document.querySelector('textarea[name="summary"]') as HTMLTextAreaElement;
    name.value="Synthetic Customer";summary.value="Needs help";
    await act(async()=>{document.querySelector("form.runtime-form")!.dispatchEvent(new SubmitEvent("submit",{bubbles:true,cancelable:true}));});
    expect(onCreate).toHaveBeenCalledOnce();const notice=document.querySelector(".runtime-notice-visible");expect(notice?.textContent).toContain("Current access is read only");
  });

  it("hydrates the neutral timestamp placeholder into browser-local text",async()=>{
    const html=renderToString(<FocusedWorkspaceView {...props(false)}/>);expect(html).toContain("Local time loading");
    const container=document.createElement("div");container.innerHTML=html;document.body.append(container);
    let root!:ReturnType<typeof hydrateRoot>;await act(async()=>{root=hydrateRoot(container,<FocusedWorkspaceView {...props(false)}/>);});roots.push(root);
    expect(container.textContent).not.toContain("Local time loading");expect(container.querySelector("time")?.textContent).toBeTruthy();
  });
  it("places the shared toolbar across both desktop grid columns",()=>{
    const style=document.createElement("style");style.textContent=readFileSync(`${process.cwd()}/src/app/runtime/runtime.css`,"utf8");document.head.append(style);
    const container=document.createElement("div");document.body.append(container);const root=createRoot(container);roots.push(root);act(()=>root.render(<FocusedWorkspaceView {...props(false)}/>));
    expect(getComputedStyle(container.querySelector(".family-workdesk-toolbar")!).gridColumn).toBe("1 / -1");style.remove();
  });
});
