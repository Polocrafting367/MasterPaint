// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
use masterpaint_core::apply_image;

fn fixture() -> Vec<u8> {
    (0..24*20).flat_map(|i| {
        let (x,y)=(i%24,i/24);
        [(x*11) as u8,(y*13) as u8,((x+y)*5) as u8,if x>5 && x<19 && y>4 && y<16 {255} else {0}]
    }).collect()
}

#[test]
fn optional_colors_preserve_previous_defaults_exactly() {
    let src=fixture();
    for (effect,old,color) in [("outline",vec![3.0,50.0],0.0),("edges",vec![40.0],0xffffff as f32),("softglow",vec![6.0,40.0],0xffffff as f32)] {
        let mut explicit=old.clone();explicit.push(color);
        assert_eq!(apply_image(effect,&src,24,20,&old),apply_image(effect,&src,24,20,&explicit),"{effect}");
    }
}

#[test]
fn outline_edges_and_glow_apply_color_without_changing_alpha() {
    let src=fixture();
    for (effect,params,channel) in [("outline",vec![3.0,50.0,0xff0000 as f32],0),("edges",vec![40.0,0x00ff00 as f32],1),("softglow",vec![6.0,40.0,0x0000ff as f32],2)] {
        let out=apply_image(effect,&src,24,20,&params).unwrap();
        let baseline=apply_image(effect,&src,24,20,&params[..params.len()-1]).unwrap();
        assert!(out.chunks_exact(4).zip(baseline.chunks_exact(4)).all(|(a,b)|a[3]==b[3]),"{effect}");
        match effect {
            "outline" => assert!(out.chunks_exact(4).all(|p|p[channel]==255)),
            "edges" => { assert!(out.chunks_exact(4).any(|p|p[channel]>0));assert!(out.chunks_exact(4).all(|p|p[0]==0 && p[2]==0)); },
            _ => { assert!(out.chunks_exact(4).zip(src.chunks_exact(4)).any(|(a,b)|a[2]>b[2]));assert!(out.chunks_exact(4).zip(src.chunks_exact(4)).all(|(a,b)|a[0]==b[0] && a[1]==b[1])); }
        }
    }
}

#[test]
fn vignette_shadow_and_object_contour_use_the_chosen_color() {
    let white=[255u8;24*20*4];
    let vig=apply_image("vignette",&white,24,20,&[100.0,0xff0000 as f32,0.0,0.0,0.0]).unwrap();
    assert_eq!(&vig[..4],&[255,0,0,255]);
    assert_eq!(&vig[(10*24+12)*4..(10*24+12)*4+4],&[255,255,255,255]);
    let src=fixture();
    for (effect,params) in [("dropshadow",vec![3.0,2.0,0.0,100.0,0xff0000 as f32]),("contour",vec![2.0,0xff0000 as f32,100.0,0.0,0.0])] {
        let out=apply_image(effect,&src,24,20,&params).unwrap();
        assert!(out.chunks_exact(4).zip(src.chunks_exact(4)).any(|(a,b)|b[3]==0 && a[3]>0 && a[0]>0 && a[1]==0 && a[2]==0),"{effect}");
    }
}
