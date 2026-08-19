# Map attributions

## PF International owner-driver schematic

`public/maps/pfi-international-owner-driver.svg` is a simplified schematic generated for this project from OpenStreetMap raceway geometry downloaded from the PF International area. It is a derived work, not an official PF International promotional map.

The underlying OpenStreetMap data is © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) and is available under the [Open Data Commons Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The website displays this attribution next to the map.

The official circuit page describes the current full circuit as 1,382 m: [PF International — The Circuit](https://kartpfi.com/the-circuit). Its official artwork is not bundled here because PF International's company information page reserves rights to its content: [Company Information](https://kartpfi.com/legal/company-information).

## Whilton Mill circuit schematics

`public/maps/whilton-mill-international.svg`, `-national.svg`, `-indy.svg` and `-mill.svg` are
schematics generated for this project by `scripts/build-whilton-maps.mjs` from OpenStreetMap
raceway geometry. They are derived works, not official Whilton Mill artwork.

The source geometry is committed at `scripts/data/whilton-mill-osm.json`, retrieved from the
Overpass API on 2026-08-19. It covers the three circuit relations Whilton Mill has mapped —
International (16338535), National (16338536) and Indy (16338537) — plus the closed way for the
Mill circuit (149913876) and the two pit lanes. The underlying data is
© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) and available under the
[Open Data Commons Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
Every generated file carries the attribution in its own caption, and the website shows it beneath
the map.

The lap length printed on each map is the measured centreline of that geometry: 1,040 m
(International), 845 m (National), 665 m (Indy) and 441 m (Mill). These are labelled "centreline"
because they are not the operator's published distances. Whilton Mill's karting page quotes a
"450m Mill Circuit" and a "960m National Circuit"; the Mill measurement lands within 2% of the
first, but the National is well short of the second, which suggests the published figure is
measured differently or refers to a different configuration. No official figure is reproduced
here as if it were derived from this data.
