export {}

export type Roles = "admin" | "student" | "super_admin" | "committee";

declare global {
    interface CustomJwtSessionClaims {
        metadata: {
            role?: Roles;
        };
    }
}
