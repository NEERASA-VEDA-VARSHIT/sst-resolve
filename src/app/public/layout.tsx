/**
 * Public dashboard layout - accessible to all, including admins and super admins
 * Note: Navigation is already included in the root layout, so we don't need to add it here
 */
export default function PublicLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<>
			{children}
		</>
	);
}

