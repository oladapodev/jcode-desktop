/** Mock repository contents for the editor, files and changes panes. */
export const files: Record<string, { lang: 'rust' | 'toml' | 'md' | 'ts'; text: string; before?: string; status?: 'M' | 'A' }> = {
  'src/scene/korope.rs': {
    lang: 'rust',
    status: 'M',
    before: `use crate::mesh::{Mesh, Roof, Grille};
use crate::paint::Livery;

/// Lagos korope minibus.
pub fn korope_body() -> Mesh {
    let roof = Roof::flat(1.42);
    let cab = cab_shell(0.94);
    Mesh::join([cab, roof])
}

fn cab_shell(width: f32) -> Mesh {
    Mesh::boxed(width, 1.1, 2.2).bevel(0.04)
}
`,
    text: `use crate::mesh::{Mesh, Roof, Grille};
use crate::paint::Livery;

/// Lagos korope minibus, modelled on the Suzuki Every (DA52) high roof.
pub fn korope_body() -> Mesh {
    let roof = Roof::high(1.58).with_drip_rail();
    let grille = Grille::da52();
    let cab = cab_shell(0.94);

    // Faded blue livery sampled from the reference photos.
    let paint = Livery::faded("#3f78b5", 0.35);

    Mesh::join([cab, roof, grille]).paint(paint)
}

fn cab_shell(width: f32) -> Mesh {
    Mesh::boxed(width, 1.1, 2.2)
        .bevel(0.04)
        .with_sliding_door(Side::Left)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roof_height_matches_reference() {
        let body = korope_body();
        assert!((body.height() - 1.58).abs() < 1e-3);
    }
}
`,
  },
  'src/scene/danfo_roof.rs': {
    lang: 'rust',
    status: 'M',
    before: `pub fn roof_joints(body: &Body) -> Seam {
    let seam = body.roof_edge();
    seam.offset(0.04)
}
`,
    text: `pub fn roof_joints(body: &Body) -> Seam {
    let seam = body.roof_edge();
    // Weld the roof edge onto the pillar so no gap shows in renders.
    let gap = seam.offset(0.0).weld(&body.pillar);
    debug_assert!(gap.max_distance() < 1e-3);
    gap
}
`,
  },
  'assets/provenance.toml': {
    lang: 'toml',
    status: 'A',
    before: '',
    text: `[korope]
model = "Suzuki Every DA52"
photos = ["front.jpg", "side.jpg", "rear.jpg"]
license = "own work"

[danfo]
model = "Volkswagen T3"
`,
  },
  'src/main.rs': {
    lang: 'rust',
    text: `mod scene;
mod mesh;
mod paint;

fn main() {
    let world = scene::lagos_street();
    renderer::run(world);
}
`,
  },
  'README.md': {
    lang: 'md',
    text: `# tasued

Realistic Lagos street scenes. Run with \`cargo run --release\`.
`,
  },
}

export type TreeNode = { name: string; path: string; dir?: boolean; children?: TreeNode[] }
export const tree: TreeNode[] = [
  { name: 'src', path: 'src', dir: true, children: [
    { name: 'scene', path: 'src/scene', dir: true, children: [
      { name: 'korope.rs', path: 'src/scene/korope.rs' },
      { name: 'danfo_roof.rs', path: 'src/scene/danfo_roof.rs' },
      { name: 'lighting.rs', path: 'src/scene/lighting.rs' },
    ]},
    { name: 'main.rs', path: 'src/main.rs' },
  ]},
  { name: 'assets', path: 'assets', dir: true, children: [{ name: 'provenance.toml', path: 'assets/provenance.toml' }] },
  { name: 'reference', path: 'reference', dir: true, children: [] },
  { name: 'Cargo.toml', path: 'Cargo.toml' },
  { name: 'README.md', path: 'README.md' },
]
