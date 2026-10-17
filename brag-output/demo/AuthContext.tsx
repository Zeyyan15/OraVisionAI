// Local video fixture only. Vite substitutes this module solely in demo/start.mjs.
// No Firebase account, credential, production auth change, or real identity.
import React, {createContext, useState} from 'react';
export type AuthContextType = any;
export const AuthContext = createContext<any>(undefined);
export function AuthProvider({children}: any) {
  const role = location.pathname.startsWith('/dentist') ? 'dentist' : 'patient';
  const profile = {id:role, role, first_name:'Demo', last_name:role==='dentist'?'Dentist':'Patient', email:role+'@oravision.test', is_active:true, is_email_verified:true};
  const [userProfile] = useState(profile);
  const value = {userProfile, firebaseUser:{uid:role}, loading:false, error:null, login:async()=>profile, register:async()=>profile, logout:async()=>{}, refreshProfile:async()=>profile};
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
