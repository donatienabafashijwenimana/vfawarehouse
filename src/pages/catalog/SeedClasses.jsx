import CatalogPage from './CatalogPage';

export default function SeedClasses() {
  return (
    <CatalogPage
      title="Seed Class Management"
      subtitle="Generation classes: Pre-basic, Basic, Certified (spec §11)"
      entityKey="seedClasses"
      addKey="addSeedClass"
      updateKey="updateSeedClass"
      deleteKey="deleteSeedClass"
      addLabel="Seed Class"
      columns={[
        { key: 'name', label: 'Class', render: (r) => <span className="font-semibold text-gray-700">{r.name}</span> },
        { key: 'description', label: 'Description', render: (r) => <span className="text-gray-500">{r.description}</span> },
      ]}
      fields={[
        { key: 'name', label: 'Class name', required: true },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]}
    />
  );
}
