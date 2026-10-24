declare module "node-zklib";
declare module "arabic-reshaper";

declare namespace Express {
  export interface Request {
    userManagementScope?: { unrestricted: boolean; modules: string[] };
  }
}
