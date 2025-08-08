"use client";
import React, { createContext } from "react";

const UserDetailContext = createContext();

function Provider({ children }) {
  return (
    <UserDetailContext.Provider value={{}}>
      <div className="w-full">{children}</div>
    </UserDetailContext.Provider>
  );
}

export default Provider;
