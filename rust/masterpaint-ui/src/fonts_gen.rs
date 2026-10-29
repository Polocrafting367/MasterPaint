// Fichier généré : polices du dossier fonts/ de MasterPaint (WOFF2).
// Bureau : intégrées au programme ; web : téléchargées à la demande depuis fonts/.
use crate::text::Source;

#[cfg(not(target_arch = "wasm32"))]
macro_rules! inc_font {
    ($p:literal) => {
        include_bytes!($p)
    };
}
#[cfg(target_arch = "wasm32")]
macro_rules! inc_font {
    ($p:literal) => {
        ()
    };
}

pub fn masterpaint_fonts() -> Vec<(&'static str, Source)> {
    vec![
        ("1942 Report", src(inc_font!("../../../fonts/1942 Report.woff2"), "/fonts/1942 Report.woff2")),
        ("8 Bit Wonder", src(inc_font!("../../../fonts/8 Bit Wonder.woff2"), "/fonts/8 Bit Wonder.woff2")),
        ("A Dripping Marker", src(inc_font!("../../../fonts/A Dripping Marker.woff2"), "/fonts/A Dripping Marker.woff2")),
        ("African", src(inc_font!("../../../fonts/African.woff2"), "/fonts/African.woff2")),
        ("Airmole Antique", src(inc_font!("../../../fonts/Airmole Antique.woff2"), "/fonts/Airmole Antique.woff2")),
        ("Airmole Regular", src(inc_font!("../../../fonts/Airmole Regular.woff2"), "/fonts/Airmole Regular.woff2")),
        ("Airmole Shaded", src(inc_font!("../../../fonts/Airmole Shaded.woff2"), "/fonts/Airmole Shaded.woff2")),
        ("Airmole Stripe", src(inc_font!("../../../fonts/Airmole Stripe.woff2"), "/fonts/Airmole Stripe.woff2")),
        ("Alphabits Fat", src(inc_font!("../../../fonts/Alphabits Fat.woff2"), "/fonts/Alphabits Fat.woff2")),
        ("Alphabits Light", src(inc_font!("../../../fonts/Alphabits Light.woff2"), "/fonts/Alphabits Light.woff2")),
        ("Alphabits Regular", src(inc_font!("../../../fonts/Alphabits Regular.woff2"), "/fonts/Alphabits Regular.woff2")),
        ("Amatic SC", src(inc_font!("../../../fonts/Amatic SC.woff2"), "/fonts/Amatic SC.woff2")),
        ("Art Brush", src(inc_font!("../../../fonts/Art Brush.woff2"), "/fonts/Art Brush.woff2")),
        ("Audiowide", src(inc_font!("../../../fonts/Audiowide.woff2"), "/fonts/Audiowide.woff2")),
        ("Augusta Shadow", src(inc_font!("../../../fonts/Augusta Shadow.woff2"), "/fonts/Augusta Shadow.woff2")),
        ("Augusta", src(inc_font!("../../../fonts/Augusta.woff2"), "/fonts/Augusta.woff2")),
        ("Averia Serif Bold", src(inc_font!("../../../fonts/Averia Serif Bold.woff2"), "/fonts/Averia Serif Bold.woff2")),
        ("Baldur Shadow", src(inc_font!("../../../fonts/Baldur Shadow.woff2"), "/fonts/Baldur Shadow.woff2")),
        ("Baldur", src(inc_font!("../../../fonts/Baldur.woff2"), "/fonts/Baldur.woff2")),
        ("Bangers", src(inc_font!("../../../fonts/Bangers.woff2"), "/fonts/Bangers.woff2")),
        ("Black Ops One", src(inc_font!("../../../fonts/Black Ops One.woff2"), "/fonts/Black Ops One.woff2")),
        ("Blues MK2", src(inc_font!("../../../fonts/Blues MK2.woff2"), "/fonts/Blues MK2.woff2")),
        ("Bones Font", src(inc_font!("../../../fonts/Bones Font.woff2"), "/fonts/Bones Font.woff2")),
        ("Boston Traffic", src(inc_font!("../../../fonts/Boston Traffic.woff2"), "/fonts/Boston Traffic.woff2")),
        ("Bullpen HV Italic", src(inc_font!("../../../fonts/Bullpen HV Italic.woff2"), "/fonts/Bullpen HV Italic.woff2")),
        ("Bullpen Three D", src(inc_font!("../../../fonts/Bullpen Three D.woff2"), "/fonts/Bullpen Three D.woff2")),
        ("Bungee", src(inc_font!("../../../fonts/Bungee.woff2"), "/fonts/Bungee.woff2")),
        ("Caveat", src(inc_font!("../../../fonts/Caveat.woff2"), "/fonts/Caveat.woff2")),
        ("Chinese Calligraphy", src(inc_font!("../../../fonts/Chinese Calligraphy.woff2"), "/fonts/Chinese Calligraphy.woff2")),
        ("Comic Sans MS (Clone)", src(inc_font!("../../../fonts/Comic Sans MS (Clone).woff2"), "/fonts/Comic Sans MS (Clone).woff2")),
        ("comic-sans-ms", src(inc_font!("../../../fonts/comic-sans-ms.woff2"), "/fonts/comic-sans-ms.woff2")),
        ("Corleone", src(inc_font!("../../../fonts/Corleone.woff2"), "/fonts/Corleone.woff2")),
        ("Creepster", src(inc_font!("../../../fonts/Creepster.woff2"), "/fonts/Creepster.woff2")),
        ("Crystal Radio Kit", src(inc_font!("../../../fonts/Crystal Radio Kit.woff2"), "/fonts/Crystal Radio Kit.woff2")),
        ("Dancing Script", src(inc_font!("../../../fonts/Dancing Script.woff2"), "/fonts/Dancing Script.woff2")),
        ("Digit", src(inc_font!("../../../fonts/Digit.woff2"), "/fonts/Digit.woff2")),
        ("Display Free TFB", src(inc_font!("../../../fonts/Display Free TFB.woff2"), "/fonts/Display Free TFB.woff2")),
        ("DotGothic16", src(inc_font!("../../../fonts/DotGothic16.woff2"), "/fonts/DotGothic16.woff2")),
        ("Felt Pen", src(inc_font!("../../../fonts/Felt Pen.woff2"), "/fonts/Felt Pen.woff2")),
        ("FranceTV", src(inc_font!("../../../fonts/FranceTV.woff2"), "/fonts/FranceTV.woff2")),
        ("Gomo", src(inc_font!("../../../fonts/Gomo.woff2"), "/fonts/Gomo.woff2")),
        ("Graffiti Font", src(inc_font!("../../../fonts/Graffiti Font.woff2"), "/fonts/Graffiti Font.woff2")),
        ("Great Vibes", src(inc_font!("../../../fonts/Great Vibes.woff2"), "/fonts/Great Vibes.woff2")),
        ("Ice Age", src(inc_font!("../../../fonts/Ice Age.woff2"), "/fonts/Ice Age.woff2")),
        ("Indie Flower", src(inc_font!("../../../fonts/Indie Flower.woff2"), "/fonts/Indie Flower.woff2")),
        ("Karate", src(inc_font!("../../../fonts/Karate.woff2"), "/fonts/Karate.woff2")),
        ("Kingthings Petrock light", src(inc_font!("../../../fonts/Kingthings Petrock light.woff2"), "/fonts/Kingthings Petrock light.woff2")),
        ("Kingthings Sans", src(inc_font!("../../../fonts/Kingthings Sans.woff2"), "/fonts/Kingthings Sans.woff2")),
        ("Kirsty Bold", src(inc_font!("../../../fonts/Kirsty Bold.woff2"), "/fonts/Kirsty Bold.woff2")),
        ("Lobster", src(inc_font!("../../../fonts/Lobster.woff2"), "/fonts/Lobster.woff2")),
        ("Mary Jane deGroot", src(inc_font!("../../../fonts/Mary Jane deGroot.woff2"), "/fonts/Mary Jane deGroot.woff2")),
        ("Mary Jane Gilardino", src(inc_font!("../../../fonts/Mary Jane Gilardino.woff2"), "/fonts/Mary Jane Gilardino.woff2")),
        ("Mary Jane Olyff", src(inc_font!("../../../fonts/Mary Jane Olyff.woff2"), "/fonts/Mary Jane Olyff.woff2")),
        ("Mary Jane Tankard", src(inc_font!("../../../fonts/Mary Jane Tankard.woff2"), "/fonts/Mary Jane Tankard.woff2")),
        ("Matthan Sans Italic", src(inc_font!("../../../fonts/Matthan Sans Italic.woff2"), "/fonts/Matthan Sans Italic.woff2")),
        ("Michroma", src(inc_font!("../../../fonts/Michroma.woff2"), "/fonts/Michroma.woff2")),
        ("Mignone", src(inc_font!("../../../fonts/Mignone.woff2"), "/fonts/Mignone.woff2")),
        ("Minecraft", src(inc_font!("../../../fonts/Minecraft.woff2"), "/fonts/Minecraft.woff2")),
        ("MK Stencil Sans Black", src(inc_font!("../../../fonts/MK Stencil Sans Black.woff2"), "/fonts/MK Stencil Sans Black.woff2")),
        ("Neretta Beveled", src(inc_font!("../../../fonts/Neretta Beveled.woff2"), "/fonts/Neretta Beveled.woff2")),
        ("Neretta Shadow", src(inc_font!("../../../fonts/Neretta Shadow.woff2"), "/fonts/Neretta Shadow.woff2")),
        ("NFS Font", src(inc_font!("../../../fonts/NFS Font.woff2"), "/fonts/NFS Font.woff2")),
        ("Ninja Naruto", src(inc_font!("../../../fonts/Ninja Naruto.woff2"), "/fonts/Ninja Naruto.woff2")),
        ("Nisaba", src(inc_font!("../../../fonts/Nisaba.woff2"), "/fonts/Nisaba.woff2")),
        ("Old Book", src(inc_font!("../../../fonts/Old Book.woff2"), "/fonts/Old Book.woff2")),
        ("Old London", src(inc_font!("../../../fonts/Old London.woff2"), "/fonts/Old London.woff2")),
        ("Orbitron", src(inc_font!("../../../fonts/Orbitron.woff2"), "/fonts/Orbitron.woff2")),
        ("Pacifico", src(inc_font!("../../../fonts/Pacifico.woff2"), "/fonts/Pacifico.woff2")),
        ("Painty Paint", src(inc_font!("../../../fonts/Painty Paint.woff2"), "/fonts/Painty Paint.woff2")),
        ("Patinio Graffiti", src(inc_font!("../../../fonts/Patinio Graffiti.woff2"), "/fonts/Patinio Graffiti.woff2")),
        ("Peake Doubled", src(inc_font!("../../../fonts/Peake Doubled.woff2"), "/fonts/Peake Doubled.woff2")),
        ("Peake Shadow", src(inc_font!("../../../fonts/Peake Shadow.woff2"), "/fonts/Peake Shadow.woff2")),
        ("Peake", src(inc_font!("../../../fonts/Peake.woff2"), "/fonts/Peake.woff2")),
        ("Permanent Marker", src(inc_font!("../../../fonts/Permanent Marker.woff2"), "/fonts/Permanent Marker.woff2")),
        ("Phone Streak", src(inc_font!("../../../fonts/Phone Streak.woff2"), "/fonts/Phone Streak.woff2")),
        ("Pixelify Sans", src(inc_font!("../../../fonts/Pixelify Sans.woff2"), "/fonts/Pixelify Sans.woff2")),
        ("Press Start 2P", src(inc_font!("../../../fonts/Press Start 2P.woff2"), "/fonts/Press Start 2P.woff2")),
        ("Quael Gothic Hollow", src(inc_font!("../../../fonts/Quael Gothic Hollow.woff2"), "/fonts/Quael Gothic Hollow.woff2")),
        ("Quael Gothic", src(inc_font!("../../../fonts/Quael Gothic.woff2"), "/fonts/Quael Gothic.woff2")),
        ("Righteous", src(inc_font!("../../../fonts/Righteous.woff2"), "/fonts/Righteous.woff2")),
        ("Russo One", src(inc_font!("../../../fonts/Russo One.woff2"), "/fonts/Russo One.woff2")),
        ("Satisfy", src(inc_font!("../../../fonts/Satisfy.woff2"), "/fonts/Satisfy.woff2")),
        ("Share Tech Mono", src(inc_font!("../../../fonts/Share Tech Mono.woff2"), "/fonts/Share Tech Mono.woff2")),
        ("Silkscreen", src(inc_font!("../../../fonts/Silkscreen.woff2"), "/fonts/Silkscreen.woff2")),
        ("Stab", src(inc_font!("../../../fonts/Stab.woff2"), "/fonts/Stab.woff2")),
        ("Starjhol", src(inc_font!("../../../fonts/Starjhol.woff2"), "/fonts/Starjhol.woff2")),
        ("Starjout", src(inc_font!("../../../fonts/Starjout.woff2"), "/fonts/Starjout.woff2")),
        ("starwars", src(inc_font!("../../../fonts/starwars.woff2"), "/fonts/starwars.woff2")),
        ("Super Mario 256", src(inc_font!("../../../fonts/Super Mario 256.woff2"), "/fonts/Super Mario 256.woff2")),
        ("To Be Continued", src(inc_font!("../../../fonts/To Be Continued.woff2"), "/fonts/To Be Continued.woff2")),
        ("Verve Shadow", src(inc_font!("../../../fonts/Verve Shadow.woff2"), "/fonts/Verve Shadow.woff2")),
        ("Verve", src(inc_font!("../../../fonts/Verve.woff2"), "/fonts/Verve.woff2")),
        ("VT323", src(inc_font!("../../../fonts/VT323.woff2"), "/fonts/VT323.woff2")),
    ]
}

#[cfg(not(target_arch = "wasm32"))]
fn src(bytes: &'static [u8], _path: &str) -> Source {
    Source::Static(bytes)
}

#[cfg(target_arch = "wasm32")]
fn src(_bytes: (), path: &str) -> Source {
    Source::Web(path.to_string())
}

