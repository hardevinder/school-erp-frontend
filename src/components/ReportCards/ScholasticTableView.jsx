import React from "react";

const ScholasticTableView = ({ students = [] }) => {
  if (students.length === 0) return <p>No data available</p>;

  const groups = Object.entries(students[0].subject_totals_raw || {}).map(([subject_id]) => ({
    subject_id: parseInt(subject_id),
    subject_name:
      students[0].components.find((c) => c.subject_id === parseInt(subject_id))?.name || `Subject ${subject_id}`,
    components: students[0].components.filter((c) => c.subject_id === parseInt(subject_id)),
  }));

  return (
    <div className="table-responsive mb-4">
      <table className="table table-bordered table-sm table-striped">
        <thead>
          <tr>
            <th>Roll No</th>
            <th>Name</th>
            {groups.flatMap((group) =>
              group.components.map((comp) => (
                <th key={`${group.subject_id}-${comp.component_id}`}>
                  {group.subject_name} - {comp.name}
                </th>
              )).concat(
                <th key={`total-${group.subject_id}`}>Total ({group.subject_name})</th>
              )
            )}
            <th>Grand Total</th>
            <th>Weighted Total</th>
          </tr>
        </thead>
        <tbody>
          {students.map((stu) => (
            <tr key={stu.id}>
              <td>{stu.roll_number}</td>
              <td>{stu.name}</td>
              {groups.flatMap((group) => {
                const comps = group.components.map((comp) => {
                  const c = stu.components.find(
                    (sc) =>
                      sc.component_id === comp.component_id &&
                      sc.subject_id === group.subject_id
                  );
                  return (
                    <td key={`${stu.id}-${comp.component_id}`}>
                      {c?.marks ?? "-"} ({c?.grade ?? "-"})
                    </td>
                  );
                });
                const total = stu.subject_totals_raw[group.subject_id] ?? "-";
                return comps.concat(
                  <td key={`total-${stu.id}-${group.subject_id}`}>
                    <strong>{total}</strong>
                  </td>
                );
              })}
              <td><strong>{stu.total_raw}</strong></td>
              <td><strong>{stu.total_weighted}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ScholasticTableView;
