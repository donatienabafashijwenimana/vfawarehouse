import CatalogPage from './CatalogPage';

export default function Varieties() {
  return (
    <CatalogPage
      title="Seed Variety Management"
      subtitle="Irish potato varieties produced by VFA (spec §10)"
      entityKey="varieties"
      addKey="addVariety"
      updateKey="updateVariety"
      deleteKey="deleteVariety"
      addLabel="Variety"
      columns={[
        { key: 'name', label: 'Variety', render: (r) => <span className="font-semibold text-gray-700">{r.name}</span> },
        { key: 'description', label: 'Description', render: (r) => <span className="text-gray-500">{r.description}</span> },
        { key: 'recommended_use', label: 'Recommended Area / Use', render: (r) => <span className="text-gray-500">{r.recommended_use}</span> },
      ]}
      fields={[
        { key: 'name', label: 'Variety name', required: true },
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'recommended_use', label: 'Recommended area / use' },
      ]}
    />
  );
}
