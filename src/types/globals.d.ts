export {}

export type Roles = "admin" | "snr_admin" | "student" | "super_admin" | "committee";

declare global {
    interface CustomJwtSessionClaims {
        metadata: {
            role?: Roles;
        };
    }
}
