# catalog

System font catalog: `catalogRows` joins the OS fonts dataset with `osAvailability` per
system, `audienceCoverage` weights the availability (preinstalled 1, some versions 0.5,
on demand and unknown 0) by the audience share of each system, `sortRows` backs the
sortable table. `CatalogTable` is the island with the audience editor and the table.
