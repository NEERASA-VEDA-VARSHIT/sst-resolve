import { MasterDataManagement } from "@/components/admin/master-data";

// Use ISR - revalidate every 5 minutes (master data changes infrequently)
export const revalidate = 300;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export default async function MasterDataPage() {
  // Fetch all master data from API in parallel
  const [sectionsRes, batchesRes, hostelsRes] = await Promise.all([
    fetch(`${API_BASE_URL}/master/class-sections`, {
      next: { revalidate: 300 },
    }),
    fetch(`${API_BASE_URL}/master/batches`, {
      next: { revalidate: 300 },
    }),
    fetch(`${API_BASE_URL}/master/hostels`, {
      next: { revalidate: 300 },
    }),
  ]);

  const sections = sectionsRes.ok ? await sectionsRes.json() : [];
  const batchesList = batchesRes.ok ? await batchesRes.json() : [];
  const hostelsList = hostelsRes.ok ? await hostelsRes.json() : [];

  return (
    <MasterDataManagement
      initialSections={sections}
      initialBatches={batchesList}
      initialHostels={hostelsList}
    />
  );
}
