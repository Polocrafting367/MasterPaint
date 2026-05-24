(module
 (type $0 (func (param i32 i32) (result i32)))
 (type $1 (func (param i32) (result i32)))
 (type $2 (func (param i32 i32 i32 i32 f32 i32 i32)))
 (type $3 (func (param i32 i32 i32)))
 (type $4 (func (param i32 i32 i32 i32 i32 i32 i32)))
 (type $5 (func))
 (type $6 (func (param i32)))
 (type $7 (func (param i32 i32)))
 (type $8 (func (param f64) (result f64)))
 (type $9 (func (param i32 i32 i32 f32 f32 i32 i32)))
 (type $10 (func (param i32 i32 i32 i32 i32)))
 (type $11 (func (param i32 i32 i32 f32 i32 i32)))
 (type $12 (func (param i32 i32 i32 i32)))
 (type $13 (func (param i32 i32 i32 i32 i32 i32)))
 (type $14 (func (param i32 i32 i32 i32 i32 i32 i32 i32)))
 (type $15 (func (param i32 i32 i32 i32 i32 i32 i32 i32 f32)))
 (type $16 (func (param i32 i32 i32) (result i32)))
 (type $17 (func (param i32 i32 i64)))
 (type $18 (func (result i32)))
 (type $19 (func (param f64 f64) (result f64)))
 (type $20 (func (param i64) (result i32)))
 (type $21 (func (param i32 i32 i32 i32 f32 f32 i32 i32)))
 (type $22 (func (param i32 i32 i32 f32 i32 i32 i32 i32 i32 i32)))
 (type $23 (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)))
 (type $24 (func (param i32 i32 i32 i32 i32 i32 i32 i32 f32 f32)))
 (type $25 (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
 (type $26 (func (param f32 f32 f32 f32) (result f32)))
 (type $27 (func (param f32 f32 f32 f32 f32 f32) (result f32)))
 (type $28 (func (param f32 f32 f32 f32 f32 f32 f32) (result i32)))
 (type $29 (func (param f32 f32 f32 f32 f32 f32 f32 f32 f32) (result f32)))
 (type $30 (func (param i32 i32 i32 i32 f32 f32 i32 i32 i32)))
 (type $31 (func (param i32 i32 i32 i32 i32 f32 i32 i32)))
 (type $32 (func (param i32 i32 i32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 i32 i32 i32 i32)))
 (type $33 (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 f32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (global $~lib/rt/itcms/total (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/threshold (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/state (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/visitCount (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/pinSpace (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/iter (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/toSpace (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/white (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/fromSpace (mut i32) (i32.const 0))
 (global $~lib/rt/tlsf/ROOT (mut i32) (i32.const 0))
 (global $assembly/math/_hsv (mut i32) (i32.const 0))
 (global $assembly/math/_rgb (mut i32) (i32.const 0))
 (global $assembly/filters/BAYER_MATRIX (mut i32) (i32.const 0))
 (global $assembly/pdn_effects/seed (mut i32) (i32.const 12345))
 (global $assembly/index/ALPHA_ARRAY_ID i32 (i32.const 8))
 (global $~lib/util/math/log_tail (mut f64) (f64.const 0))
 (global $~lib/math/rempio2_y0 (mut f64) (f64.const 0))
 (global $~lib/math/rempio2_y1 (mut f64) (f64.const 0))
 (global $~lib/math/res128_hi (mut i64) (i64.const 0))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 41440))
 (memory $0 1)
 (data $0 (i32.const 1036) "<")
 (data $0.1 (i32.const 1048) "\02\00\00\00(\00\00\00A\00l\00l\00o\00c\00a\00t\00i\00o\00n\00 \00t\00o\00o\00 \00l\00a\00r\00g\00e")
 (data $1 (i32.const 1100) "<")
 (data $1.1 (i32.const 1112) "\02\00\00\00 \00\00\00~\00l\00i\00b\00/\00r\00t\00/\00i\00t\00c\00m\00s\00.\00t\00s")
 (data $4 (i32.const 1228) "<")
 (data $4.1 (i32.const 1240) "\02\00\00\00$\00\00\00I\00n\00d\00e\00x\00 \00o\00u\00t\00 \00o\00f\00 \00r\00a\00n\00g\00e")
 (data $5 (i32.const 1292) ",")
 (data $5.1 (i32.const 1304) "\02\00\00\00\14\00\00\00~\00l\00i\00b\00/\00r\00t\00.\00t\00s")
 (data $7 (i32.const 1372) "<")
 (data $7.1 (i32.const 1384) "\02\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00t\00l\00s\00f\00.\00t\00s")
 (data $8 (i32.const 1436) "<")
 (data $8.1 (i32.const 1448) "\01\00\00\00 \00\00\00\00\00\00\00 \00\00\00\08\00\00\00(\00\00\00\02\00\00\00\"\00\00\00\n\00\00\00*")
 (data $9 (i32.const 1500) "<")
 (data $9.1 (i32.const 1512) "\01\00\00\00 \00\00\000\00\00\00\10\00\00\008\00\00\00\18\00\00\002\00\00\00\12\00\00\00:\00\00\00\1a")
 (data $10 (i32.const 1564) "<")
 (data $10.1 (i32.const 1576) "\01\00\00\00 \00\00\00\0c\00\00\00,\00\00\00\04\00\00\00$\00\00\00\0e\00\00\00.\00\00\00\06\00\00\00&")
 (data $11 (i32.const 1628) "<")
 (data $11.1 (i32.const 1640) "\01\00\00\00 \00\00\00<\00\00\00\1c\00\00\004\00\00\00\14\00\00\00>\00\00\00\1e\00\00\006\00\00\00\16")
 (data $12 (i32.const 1692) "<")
 (data $12.1 (i32.const 1704) "\01\00\00\00 \00\00\00\03\00\00\00#\00\00\00\0b\00\00\00+\00\00\00\01\00\00\00!\00\00\00\t\00\00\00)")
 (data $13 (i32.const 1756) "<")
 (data $13.1 (i32.const 1768) "\01\00\00\00 \00\00\003\00\00\00\13\00\00\00;\00\00\00\1b\00\00\001\00\00\00\11\00\00\009\00\00\00\19")
 (data $14 (i32.const 1820) "<")
 (data $14.1 (i32.const 1832) "\01\00\00\00 \00\00\00\0f\00\00\00/\00\00\00\07\00\00\00\'\00\00\00\r\00\00\00-\00\00\00\05\00\00\00%")
 (data $15 (i32.const 1884) "<")
 (data $15.1 (i32.const 1896) "\01\00\00\00 \00\00\00?\00\00\00\1f\00\00\007\00\00\00\17\00\00\00=\00\00\00\1d\00\00\005\00\00\00\15")
 (data $16 (i32.const 1948) ",")
 (data $16.1 (i32.const 1960) "\02\00\00\00\1a\00\00\00~\00l\00i\00b\00/\00a\00r\00r\00a\00y\00.\00t\00s")
 (data $17 (i32.const 1996) ",")
 (data $17.1 (i32.const 2008) "\02\00\00\00\1c\00\00\00I\00n\00v\00a\00l\00i\00d\00 \00l\00e\00n\00g\00t\00h")
 (data $18 (i32.const 2044) "<")
 (data $18.1 (i32.const 2056) "\02\00\00\00&\00\00\00~\00l\00i\00b\00/\00a\00r\00r\00a\00y\00b\00u\00f\00f\00e\00r\00.\00t\00s")
 (data $19 (i32.const 2117) "\a0\f6?")
 (data $19.1 (i32.const 2129) "\c8\b9\f2\82,\d6\bf\80V7($\b4\fa<\00\00\00\00\00\80\f6?")
 (data $19.2 (i32.const 2161) "\08X\bf\bd\d1\d5\bf \f7\e0\d8\08\a5\1c\bd\00\00\00\00\00`\f6?")
 (data $19.3 (i32.const 2193) "XE\17wv\d5\bfmP\b6\d5\a4b#\bd\00\00\00\00\00@\f6?")
 (data $19.4 (i32.const 2225) "\f8-\87\ad\1a\d5\bf\d5g\b0\9e\e4\84\e6\bc\00\00\00\00\00 \f6?")
 (data $19.5 (i32.const 2257) "xw\95_\be\d4\bf\e0>)\93i\1b\04\bd\00\00\00\00\00\00\f6?")
 (data $19.6 (i32.const 2289) "`\1c\c2\8ba\d4\bf\cc\84LH/\d8\13=\00\00\00\00\00\e0\f5?")
 (data $19.7 (i32.const 2321) "\a8\86\860\04\d4\bf:\0b\82\ed\f3B\dc<\00\00\00\00\00\c0\f5?")
 (data $19.8 (i32.const 2353) "HiUL\a6\d3\bf`\94Q\86\c6\b1 =\00\00\00\00\00\a0\f5?")
 (data $19.9 (i32.const 2385) "\80\98\9a\ddG\d3\bf\92\80\c5\d4MY%=\00\00\00\00\00\80\f5?")
 (data $19.10 (i32.const 2417) " \e1\ba\e2\e8\d2\bf\d8+\b7\99\1e{&=\00\00\00\00\00`\f5?")
 (data $19.11 (i32.const 2449) "\88\de\13Z\89\d2\bf?\b0\cf\b6\14\ca\15=\00\00\00\00\00`\f5?")
 (data $19.12 (i32.const 2481) "\88\de\13Z\89\d2\bf?\b0\cf\b6\14\ca\15=\00\00\00\00\00@\f5?")
 (data $19.13 (i32.const 2513) "x\cf\fbA)\d2\bfv\daS($Z\16\bd\00\00\00\00\00 \f5?")
 (data $19.14 (i32.const 2545) "\98i\c1\98\c8\d1\bf\04T\e7h\bc\af\1f\bd\00\00\00\00\00\00\f5?")
 (data $19.15 (i32.const 2577) "\a8\ab\ab\\g\d1\bf\f0\a8\823\c6\1f\1f=\00\00\00\00\00\e0\f4?")
 (data $19.16 (i32.const 2609) "H\ae\f9\8b\05\d1\bffZ\05\fd\c4\a8&\bd\00\00\00\00\00\c0\f4?")
 (data $19.17 (i32.const 2641) "\90s\e2$\a3\d0\bf\0e\03\f4~\eek\0c\bd\00\00\00\00\00\a0\f4?")
 (data $19.18 (i32.const 2673) "\d0\b4\94%@\d0\bf\7f-\f4\9e\b86\f0\bc\00\00\00\00\00\a0\f4?")
 (data $19.19 (i32.const 2705) "\d0\b4\94%@\d0\bf\7f-\f4\9e\b86\f0\bc\00\00\00\00\00\80\f4?")
 (data $19.20 (i32.const 2737) "@^m\18\b9\cf\bf\87<\99\ab*W\r=\00\00\00\00\00`\f4?")
 (data $19.21 (i32.const 2769) "`\dc\cb\ad\f0\ce\bf$\af\86\9c\b7&+=\00\00\00\00\00@\f4?")
 (data $19.22 (i32.const 2801) "\f0*n\07\'\ce\bf\10\ff?TO/\17\bd\00\00\00\00\00 \f4?")
 (data $19.23 (i32.const 2833) "\c0Ok!\\\cd\bf\1bh\ca\bb\91\ba!=\00\00\00\00\00\00\f4?")
 (data $19.24 (i32.const 2865) "\a0\9a\c7\f7\8f\cc\bf4\84\9fhOy\'=\00\00\00\00\00\00\f4?")
 (data $19.25 (i32.const 2897) "\a0\9a\c7\f7\8f\cc\bf4\84\9fhOy\'=\00\00\00\00\00\e0\f3?")
 (data $19.26 (i32.const 2929) "\90-t\86\c2\cb\bf\8f\b7\8b1\b0N\19=\00\00\00\00\00\c0\f3?")
 (data $19.27 (i32.const 2961) "\c0\80N\c9\f3\ca\bff\90\cd?cN\ba<\00\00\00\00\00\a0\f3?")
 (data $19.28 (i32.const 2993) "\b0\e2\1f\bc#\ca\bf\ea\c1F\dcd\8c%\bd\00\00\00\00\00\a0\f3?")
 (data $19.29 (i32.const 3025) "\b0\e2\1f\bc#\ca\bf\ea\c1F\dcd\8c%\bd\00\00\00\00\00\80\f3?")
 (data $19.30 (i32.const 3057) "P\f4\9cZR\c9\bf\e3\d4\c1\04\d9\d1*\bd\00\00\00\00\00`\f3?")
 (data $19.31 (i32.const 3089) "\d0 e\a0\7f\c8\bf\t\fa\db\7f\bf\bd+=\00\00\00\00\00@\f3?")
 (data $19.32 (i32.const 3121) "\e0\10\02\89\ab\c7\bfXJSr\90\db+=\00\00\00\00\00@\f3?")
 (data $19.33 (i32.const 3153) "\e0\10\02\89\ab\c7\bfXJSr\90\db+=\00\00\00\00\00 \f3?")
 (data $19.34 (i32.const 3185) "\d0\19\e7\0f\d6\c6\bff\e2\b2\a3j\e4\10\bd\00\00\00\00\00\00\f3?")
 (data $19.35 (i32.const 3217) "\90\a7p0\ff\c5\bf9P\10\9fC\9e\1e\bd\00\00\00\00\00\00\f3?")
 (data $19.36 (i32.const 3249) "\90\a7p0\ff\c5\bf9P\10\9fC\9e\1e\bd\00\00\00\00\00\e0\f2?")
 (data $19.37 (i32.const 3281) "\b0\a1\e3\e5&\c5\bf\8f[\07\90\8b\de \bd\00\00\00\00\00\c0\f2?")
 (data $19.38 (i32.const 3313) "\80\cbl+M\c4\bf<x5a\c1\0c\17=\00\00\00\00\00\c0\f2?")
 (data $19.39 (i32.const 3345) "\80\cbl+M\c4\bf<x5a\c1\0c\17=\00\00\00\00\00\a0\f2?")
 (data $19.40 (i32.const 3377) "\90\1e \fcq\c3\bf:T\'M\86x\f1<\00\00\00\00\00\80\f2?")
 (data $19.41 (i32.const 3409) "\f0\1f\f8R\95\c2\bf\08\c4q\170\8d$\bd\00\00\00\00\00`\f2?")
 (data $19.42 (i32.const 3441) "`/\d5*\b7\c1\bf\96\a3\11\18\a4\80.\bd\00\00\00\00\00`\f2?")
 (data $19.43 (i32.const 3473) "`/\d5*\b7\c1\bf\96\a3\11\18\a4\80.\bd\00\00\00\00\00@\f2?")
 (data $19.44 (i32.const 3505) "\90\d0|~\d7\c0\bf\f4[\e8\88\96i\n=\00\00\00\00\00@\f2?")
 (data $19.45 (i32.const 3537) "\90\d0|~\d7\c0\bf\f4[\e8\88\96i\n=\00\00\00\00\00 \f2?")
 (data $19.46 (i32.const 3569) "\e0\db1\91\ec\bf\bf\f23\a3\\Tu%\bd\00\00\00\00\00\00\f2?")
 (data $19.47 (i32.const 3602) "+n\07\'\be\bf<\00\f0*,4*=\00\00\00\00\00\00\f2?")
 (data $19.48 (i32.const 3634) "+n\07\'\be\bf<\00\f0*,4*=\00\00\00\00\00\e0\f1?")
 (data $19.49 (i32.const 3665) "\c0[\8fT^\bc\bf\06\be_XW\0c\1d\bd\00\00\00\00\00\c0\f1?")
 (data $19.50 (i32.const 3697) "\e0J:m\92\ba\bf\c8\aa[\e859%=\00\00\00\00\00\c0\f1?")
 (data $19.51 (i32.const 3729) "\e0J:m\92\ba\bf\c8\aa[\e859%=\00\00\00\00\00\a0\f1?")
 (data $19.52 (i32.const 3761) "\a01\d6E\c3\b8\bfhV/M)|\13=\00\00\00\00\00\a0\f1?")
 (data $19.53 (i32.const 3793) "\a01\d6E\c3\b8\bfhV/M)|\13=\00\00\00\00\00\80\f1?")
 (data $19.54 (i32.const 3825) "`\e5\8a\d2\f0\b6\bf\das3\c97\97&\bd\00\00\00\00\00`\f1?")
 (data $19.55 (i32.const 3857) " \06?\07\1b\b5\bfW^\c6a[\02\1f=\00\00\00\00\00`\f1?")
 (data $19.56 (i32.const 3889) " \06?\07\1b\b5\bfW^\c6a[\02\1f=\00\00\00\00\00@\f1?")
 (data $19.57 (i32.const 3921) "\e0\1b\96\d7A\b3\bf\df\13\f9\cc\da^,=\00\00\00\00\00@\f1?")
 (data $19.58 (i32.const 3953) "\e0\1b\96\d7A\b3\bf\df\13\f9\cc\da^,=\00\00\00\00\00 \f1?")
 (data $19.59 (i32.const 3985) "\80\a3\ee6e\b1\bf\t\a3\8fv^|\14=\00\00\00\00\00\00\f1?")
 (data $19.60 (i32.const 4017) "\80\11\c00\n\af\bf\91\8e6\83\9eY-=\00\00\00\00\00\00\f1?")
 (data $19.61 (i32.const 4049) "\80\11\c00\n\af\bf\91\8e6\83\9eY-=\00\00\00\00\00\e0\f0?")
 (data $19.62 (i32.const 4081) "\80\19q\ddB\ab\bfLp\d6\e5z\82\1c=\00\00\00\00\00\e0\f0?")
 (data $19.63 (i32.const 4113) "\80\19q\ddB\ab\bfLp\d6\e5z\82\1c=\00\00\00\00\00\c0\f0?")
 (data $19.64 (i32.const 4145) "\c02\f6Xt\a7\bf\ee\a1\f24F\fc,\bd\00\00\00\00\00\c0\f0?")
 (data $19.65 (i32.const 4177) "\c02\f6Xt\a7\bf\ee\a1\f24F\fc,\bd\00\00\00\00\00\a0\f0?")
 (data $19.66 (i32.const 4209) "\c0\fe\b9\87\9e\a3\bf\aa\fe&\f5\b7\02\f5<\00\00\00\00\00\a0\f0?")
 (data $19.67 (i32.const 4241) "\c0\fe\b9\87\9e\a3\bf\aa\fe&\f5\b7\02\f5<\00\00\00\00\00\80\f0?")
 (data $19.68 (i32.const 4274) "x\0e\9b\82\9f\bf\e4\t~|&\80)\bd\00\00\00\00\00\80\f0?")
 (data $19.69 (i32.const 4306) "x\0e\9b\82\9f\bf\e4\t~|&\80)\bd\00\00\00\00\00`\f0?")
 (data $19.70 (i32.const 4337) "\80\d5\07\1b\b9\97\bf9\a6\fa\93T\8d(\bd\00\00\00\00\00@\f0?")
 (data $19.71 (i32.const 4370) "\fc\b0\a8\c0\8f\bf\9c\a6\d3\f6|\1e\df\bc\00\00\00\00\00@\f0?")
 (data $19.72 (i32.const 4402) "\fc\b0\a8\c0\8f\bf\9c\a6\d3\f6|\1e\df\bc\00\00\00\00\00 \f0?")
 (data $19.73 (i32.const 4434) "\10k*\e0\7f\bf\e4@\da\r?\e2\19\bd\00\00\00\00\00 \f0?")
 (data $19.74 (i32.const 4466) "\10k*\e0\7f\bf\e4@\da\r?\e2\19\bd\00\00\00\00\00\00\f0?")
 (data $19.75 (i32.const 4518) "\f0?")
 (data $19.76 (i32.const 4549) "\c0\ef?")
 (data $19.77 (i32.const 4562) "\89u\15\10\80?\e8+\9d\99k\c7\10\bd\00\00\00\00\00\80\ef?")
 (data $19.78 (i32.const 4593) "\80\93XV \90?\d2\f7\e2\06[\dc#\bd\00\00\00\00\00@\ef?")
 (data $19.79 (i32.const 4626) "\c9(%I\98?4\0cZ2\ba\a0*\bd\00\00\00\00\00\00\ef?")
 (data $19.80 (i32.const 4657) "@\e7\89]A\a0?S\d7\f1\\\c0\11\01=\00\00\00\00\00\c0\ee?")
 (data $19.81 (i32.const 4690) ".\d4\aef\a4?(\fd\bdus\16,\bd\00\00\00\00\00\80\ee?")
 (data $19.82 (i32.const 4721) "\c0\9f\14\aa\94\a8?}&Z\d0\95y\19\bd\00\00\00\00\00@\ee?")
 (data $19.83 (i32.const 4753) "\c0\dd\cds\cb\ac?\07(\d8G\f2h\1a\bd\00\00\00\00\00 \ee?")
 (data $19.84 (i32.const 4785) "\c0\06\c01\ea\ae?{;\c9O>\11\0e\bd\00\00\00\00\00\e0\ed?")
 (data $19.85 (i32.const 4817) "`F\d1;\97\b1?\9b\9e\rV]2%\bd\00\00\00\00\00\a0\ed?")
 (data $19.86 (i32.const 4849) "\e0\d1\a7\f5\bd\b3?\d7N\db\a5^\c8,=\00\00\00\00\00`\ed?")
 (data $19.87 (i32.const 4881) "\a0\97MZ\e9\b5?\1e\1d]<\06i,\bd\00\00\00\00\00@\ed?")
 (data $19.88 (i32.const 4913) "\c0\ea\n\d3\00\b7?2\ed\9d\a9\8d\1e\ec<\00\00\00\00\00\00\ed?")
 (data $19.89 (i32.const 4945) "@Y]^3\b9?\daG\bd:\\\11#=\00\00\00\00\00\c0\ec?")
 (data $19.90 (i32.const 4977) "`\ad\8d\c8j\bb?\e5h\f7+\80\90\13\bd\00\00\00\00\00\a0\ec?")
 (data $19.91 (i32.const 5009) "@\bc\01X\88\bc?\d3\acZ\c6\d1F&=\00\00\00\00\00`\ec?")
 (data $19.92 (i32.const 5041) " \n\839\c7\be?\e0E\e6\afh\c0-\bd\00\00\00\00\00@\ec?")
 (data $19.93 (i32.const 5073) "\e0\db9\91\e8\bf?\fd\n\a1O\d64%\bd\00\00\00\00\00\00\ec?")
 (data $19.94 (i32.const 5105) "\e0\'\82\8e\17\c1?\f2\07-\cex\ef!=\00\00\00\00\00\e0\eb?")
 (data $19.95 (i32.const 5137) "\f0#~+\aa\c1?4\998D\8e\a7,=\00\00\00\00\00\a0\eb?")
 (data $19.96 (i32.const 5169) "\80\86\0ca\d1\c2?\a1\b4\81\cbl\9d\03=\00\00\00\00\00\80\eb?")
 (data $19.97 (i32.const 5201) "\90\15\b0\fce\c3?\89rK#\a8/\c6<\00\00\00\00\00@\eb?")
 (data $19.98 (i32.const 5233) "\b03\83=\91\c4?x\b6\fdTy\83%=\00\00\00\00\00 \eb?")
 (data $19.99 (i32.const 5265) "\b0\a1\e4\e5\'\c5?\c7}i\e5\e83&=\00\00\00\00\00\e0\ea?")
 (data $19.100 (i32.const 5297) "\10\8c\beNW\c6?x.<,\8b\cf\19=\00\00\00\00\00\c0\ea?")
 (data $19.101 (i32.const 5329) "pu\8b\12\f0\c6?\e1!\9c\e5\8d\11%\bd\00\00\00\00\00\a0\ea?")
 (data $19.102 (i32.const 5361) "PD\85\8d\89\c7?\05C\91p\10f\1c\bd\00\00\00\00\00`\ea?")
 (data $19.103 (i32.const 5394) "9\eb\af\be\c8?\d1,\e9\aaT=\07\bd\00\00\00\00\00@\ea?")
 (data $19.104 (i32.const 5426) "\f7\dcZZ\c9?o\ff\a0X(\f2\07=\00\00\00\00\00\00\ea?")
 (data $19.105 (i32.const 5457) "\e0\8a<\ed\93\ca?i!VPCr(\bd\00\00\00\00\00\e0\e9?")
 (data $19.106 (i32.const 5489) "\d0[W\d81\cb?\aa\e1\acN\8d5\0c\bd\00\00\00\00\00\c0\e9?")
 (data $19.107 (i32.const 5521) "\e0;8\87\d0\cb?\b6\12TY\c4K-\bd\00\00\00\00\00\a0\e9?")
 (data $19.108 (i32.const 5553) "\10\f0\c6\fbo\cc?\d2+\96\c5r\ec\f1\bc\00\00\00\00\00`\e9?")
 (data $19.109 (i32.const 5585) "\90\d4\b0=\b1\cd?5\b0\15\f7*\ff*\bd\00\00\00\00\00@\e9?")
 (data $19.110 (i32.const 5617) "\10\e7\ff\0eS\ce?0\f4A`\'\12\c2<\00\00\00\00\00 \e9?")
 (data $19.111 (i32.const 5650) "\dd\e4\ad\f5\ce?\11\8e\bbe\15!\ca\bc\00\00\00\00\00\00\e9?")
 (data $19.112 (i32.const 5681) "\b0\b3l\1c\99\cf?0\df\0c\ca\ec\cb\1b=\00\00\00\00\00\c0\e8?")
 (data $19.113 (i32.const 5713) "XM`8q\d0?\91N\ed\16\db\9c\f8<\00\00\00\00\00\a0\e8?")
 (data $19.114 (i32.const 5745) "`ag-\c4\d0?\e9\ea<\16\8b\18\'=\00\00\00\00\00\80\e8?")
 (data $19.115 (i32.const 5777) "\e8\'\82\8e\17\d1?\1c\f0\a5c\0e!,\bd\00\00\00\00\00`\e8?")
 (data $19.116 (i32.const 5809) "\f8\ac\cb\\k\d1?\81\16\a5\f7\cd\9a+=\00\00\00\00\00@\e8?")
 (data $19.117 (i32.const 5841) "hZc\99\bf\d1?\b7\bdGQ\ed\a6,=\00\00\00\00\00 \e8?")
 (data $19.118 (i32.const 5873) "\b8\0emE\14\d2?\ea\baF\ba\de\87\n=\00\00\00\00\00\e0\e7?")
 (data $19.119 (i32.const 5905) "\90\dc|\f0\be\d2?\f4\04PJ\fa\9c*=\00\00\00\00\00\c0\e7?")
 (data $19.120 (i32.const 5937) "`\d3\e1\f1\14\d3?\b8<!\d3z\e2(\bd\00\00\00\00\00\a0\e7?")
 (data $19.121 (i32.const 5969) "\10\bevgk\d3?\c8w\f1\b0\cdn\11=\00\00\00\00\00\80\e7?")
 (data $19.122 (i32.const 6001) "03wR\c2\d3?\\\bd\06\b6T;\18=\00\00\00\00\00`\e7?")
 (data $19.123 (i32.const 6033) "\e8\d5#\b4\19\d4?\9d\e0\90\ec6\e4\08=\00\00\00\00\00@\e7?")
 (data $19.124 (i32.const 6065) "\c8q\c2\8dq\d4?u\d6g\t\ce\'/\bd\00\00\00\00\00 \e7?")
 (data $19.125 (i32.const 6097) "0\17\9e\e0\c9\d4?\a4\d8\n\1b\89 .\bd\00\00\00\00\00\00\e7?")
 (data $19.126 (i32.const 6129) "\a08\07\ae\"\d5?Y\c7d\81p\be.=\00\00\00\00\00\e0\e6?")
 (data $19.127 (i32.const 6161) "\d0\c8S\f7{\d5?\ef@]\ee\ed\ad\1f=\00\00\00\00\00\c0\e6?")
 (data $19.128 (i32.const 6193) "`Y\df\bd\d5\d5?\dce\a4\08*\0b\n\bd")
 (data $20 (i32.const 6222) "\f0?n\bf\88\1aO;\9b<53\fb\a9=\f6\ef?]\dc\d8\9c\13`q\bca\80w>\9a\ec\ef?\d1f\87\10z^\90\bc\85\7fn\e8\15\e3\ef?\13\f6g5R\d2\8c<t\85\15\d3\b0\d9\ef?\fa\8e\f9#\80\ce\8b\bc\de\f6\dd)k\d0\ef?a\c8\e6aN\f7`<\c8\9bu\18E\c7\ef?\99\d33[\e4\a3\90<\83\f3\c6\ca>\be\ef?m{\83]\a6\9a\97<\0f\89\f9lX\b5\ef?\fc\ef\fd\92\1a\b5\8e<\f7Gr+\92\ac\ef?\d1\9c/p=\be><\a2\d1\d32\ec\a3\ef?\0bn\90\894\03j\bc\1b\d3\fe\aff\9b\ef?\0e\bd/*RV\95\bcQ[\12\d0\01\93\ef?U\eaN\8c\ef\80P\bc\cc1l\c0\bd\8a\ef?\16\f4\d5\b9#\c9\91\bc\e0-\a9\ae\9a\82\ef?\afU\\\e9\e3\d3\80<Q\8e\a5\c8\98z\ef?H\93\a5\ea\15\1b\80\bc{Q}<\b8r\ef?=2\deU\f0\1f\8f\bc\ea\8d\8c8\f9j\ef?\bfS\13?\8c\89\8b<u\cbo\eb[c\ef?&\eb\11v\9c\d9\96\bc\d4\\\04\84\e0[\ef?`/:>\f7\ec\9a<\aa\b9h1\87T\ef?\9d8\86\cb\82\e7\8f\bc\1d\d9\fc\"PM\ef?\8d\c3\a6DAo\8a<\d6\8cb\88;F\ef?}\04\e4\b0\05z\80<\96\dc}\91I?\ef?\94\a8\a8\e3\fd\8e\96<8bunz8\ef?}Ht\f2\18^\87<?\a6\b2O\ce1\ef?\f2\e7\1f\98+G\80<\dd|\e2eE+\ef?^\08q?{\b8\96\bc\81c\f5\e1\df$\ef?1\ab\tm\e1\f7\82<\e1\de\1f\f5\9d\1e\ef?\fa\bfo\1a\9b!=\bc\90\d9\da\d0\7f\18\ef?\b4\n\0cr\827\8b<\0b\03\e4\a6\85\12\ef?\8f\cb\ce\89\92\14n<V/>\a9\af\0c\ef?\b6\ab\b0MuM\83<\15\b71\n\fe\06\ef?Lt\ac\e2\01B\86<1\d8L\fcp\01\ef?J\f8\d3]9\dd\8f<\ff\16d\b2\08\fc\ee?\04[\8e;\80\a3\86\bc\f1\9f\92_\c5\f6\ee?hPK\cc\edJ\92\bc\cb\a9:7\a7\f1\ee?\8e-Q\1b\f8\07\99\bcf\d8\05m\ae\ec\ee?\d26\94>\e8\d1q\bc\f7\9f\e54\db\e7\ee?\15\1b\ce\b3\19\19\99\bc\e5\a8\13\c3-\e3\ee?mL*\a7H\9f\85<\"4\12L\a6\de\ee?\8ai(z`\12\93\bc\1c\80\ac\04E\da\ee?[\89\17H\8f\a7X\bc*.\f7!\n\d6\ee?\1b\9aIg\9b,|\bc\97\a8P\d9\f5\d1\ee?\11\ac\c2`\edcC<-\89a`\08\ce\ee?\efd\06;\tf\96<W\00\1d\edA\ca\ee?y\03\a1\da\e1\ccn<\d0<\c1\b5\a2\c6\ee?0\12\0f?\8e\ff\93<\de\d3\d7\f0*\c3\ee?\b0\afz\bb\ce\90v<\'*6\d5\da\bf\ee?w\e0T\eb\bd\1d\93<\r\dd\fd\99\b2\bc\ee?\8e\a3q\004\94\8f\bc\a7,\9dv\b2\b9\ee?I\a3\93\dc\cc\de\87\bcBf\cf\a2\da\b6\ee?_8\0f\bd\c6\dex\bc\82O\9dV+\b4\ee?\f6\\{\ecF\12\86\bc\0f\92]\ca\a4\b1\ee?\8e\d7\fd\18\055\93<\da\'\b56G\af\ee?\05\9b\8a/\b7\98{<\fd\c7\97\d4\12\ad\ee?\tT\1c\e2\e1c\90<)TH\dd\07\ab\ee?\ea\c6\19P\85\c74<\b7FY\8a&\a9\ee?5\c0d+\e62\94<H!\ad\15o\a7\ee?\9fv\99aJ\e4\8c\bc\t\dcv\b9\e1\a5\ee?\a8M\ef;\c53\8c\bc\85U:\b0~\a4\ee?\ae\e9+\89xS\84\bc \c3\cc4F\a3\ee?XXVx\dd\ce\93\bc%\"U\828\a2\ee?d\19~\80\aa\10W<s\a9L\d4U\a1\ee?(\"^\bf\ef\b3\93\bc\cd;\7ff\9e\a0\ee?\82\b94\87\ad\12j\bc\bf\da\0bu\12\a0\ee?\ee\a9m\b8\efgc\bc/\1ae<\b2\9f\ee?Q\88\e0T=\dc\80\bc\84\94Q\f9}\9f\ee?\cf>Z~d\1fx\bct_\ec\e8u\9f\ee?\b0}\8b\c0J\ee\86\bct\81\a5H\9a\9f\ee?\8a\e6U\1e2\19\86\bc\c9gBV\eb\9f\ee?\d3\d4\t^\cb\9c\90<?]\deOi\a0\ee?\1d\a5M\b9\dc2{\bc\87\01\ebs\14\a1\ee?k\c0gT\fd\ec\94<2\c10\01\ed\a1\ee?Ul\d6\ab\e1\ebe<bN\cf6\f3\a2\ee?B\cf\b3/\c5\a1\88\bc\12\1a>T\'\a4\ee?47;\f1\b6i\93\bc\13\ceL\99\89\a5\ee?\1e\ff\19:\84^\80\bc\ad\c7#F\1a\a7\ee?nWr\d8P\d4\94\bc\ed\92D\9b\d9\a8\ee?\00\8a\0e[g\ad\90<\99f\8a\d9\c7\aa\ee?\b4\ea\f0\c1/\b7\8d<\db\a0*B\e5\ac\ee?\ff\e7\c5\9c`\b6e\bc\8cD\b5\162\af\ee?D_\f3Y\83\f6{<6w\15\99\ae\b1\ee?\83=\1e\a7\1f\t\93\bc\c6\ff\91\0b[\b4\ee?)\1el\8b\b8\a9]\bc\e5\c5\cd\b07\b7\ee?Y\b9\90|\f9#l\bc\0fR\c8\cbD\ba\ee?\aa\f9\f4\"CC\92\bcPN\de\9f\82\bd\ee?K\8ef\d7l\ca\85\bc\ba\07\cap\f1\c0\ee?\'\ce\91+\fc\afq<\90\f0\a3\82\91\c4\ee?\bbs\n\e15\d2m<##\e3\19c\c8\ee?c\"b\"\04\c5\87\bce\e5]{f\cc\ee?\d51\e2\e3\86\1c\8b<3-J\ec\9b\d0\ee?\15\bb\bc\d3\d1\bb\91\bc]%>\b2\03\d5\ee?\d21\ee\9c1\cc\90<X\b30\13\9e\d9\ee?\b3Zsn\84i\84<\bf\fdyUk\de\ee?\b4\9d\8e\97\cd\df\82\bcz\f3\d3\bfk\e3\ee?\873\cb\92w\1a\8c<\ad\d3Z\99\9f\e8\ee?\fa\d9\d1J\8f{\90\bcf\b6\8d)\07\ee\ee?\ba\ae\dcV\d9\c3U\bc\fb\15O\b8\a2\f3\ee?@\f6\a6=\0e\a4\90\bc:Y\e5\8dr\f9\ee?4\93\ad8\f4\d6h\bcG^\fb\f2v\ff\ee?5\8aXk\e2\ee\91\bcJ\06\a10\b0\05\ef?\cd\dd_\n\d7\fft<\d2\c1K\90\1e\0c\ef?\ac\98\92\fa\fb\bd\91\bc\t\1e\d7[\c2\12\ef?\b3\0c\af0\aens<\9cR\85\dd\9b\19\ef?\94\fd\9f\\2\e3\8e<z\d0\ff_\ab \ef?\acY\t\d1\8f\e0\84<K\d1W.\f1\'\ef?g\1aN8\af\cdc<\b5\e7\06\94m/\ef?h\19\92l,kg<i\90\ef\dc 7\ef?\d2\b5\cc\83\18\8a\80\bc\fa\c3]U\0b?\ef?o\fa\ff?]\ad\8f\bc|\89\07J-G\ef?I\a9u8\ae\r\90\bc\f2\89\r\08\87O\ef?\a7\07=\a6\85\a3t<\87\a4\fb\dc\18X\ef?\0f\"@ \9e\91\82\bc\98\83\c9\16\e3`\ef?\ac\92\c1\d5PZ\8e<\852\db\03\e6i\ef?Kk\01\acY:\84<`\b4\01\f3!s\ef?\1f>\b4\07!\d5\82\bc_\9b{3\97|\ef?\c9\rG;\b9*\89\bc)\a1\f5\14F\86\ef?\d3\88:`\04\b6t<\f6?\8b\e7.\90\ef?qr\9dQ\ec\c5\83<\83L\c7\fbQ\9a\ef?\f0\91\d3\8f\12\f7\8f\bc\da\90\a4\a2\af\a4\ef?}t#\e2\98\ae\8d\bc\f1g\8e-H\af\ef?\08 \aaA\bc\c3\8e<\'Za\ee\1b\ba\ef?2\eb\a9\c3\94+\84<\97\bak7+\c5\ef?\ee\85\d11\a9d\8a<@En[v\d0\ef?\ed\e3;\e4\ba7\8e\bc\14\be\9c\ad\fd\db\ef?\9d\cd\91M;\89w<\d8\90\9e\81\c1\e7\ef?\89\cc`A\c1\05S<\f1q\8f+\c2\f3\ef?")
 (data $21 (i32.const 8256) "n\83\f9\a2\00\00\00\00\d1W\'\fc)\15DN\99\95b\db\c0\dd4\f5\abcQ\feA\90C<:n$\b7a\c5\bb\de\ea.I\06\e0\d2MB\1c\eb\1d\fe\1c\92\d1\t\f55\82\e8>\a7)\b1&p\9c\e9\84D\bb.9\d6\919A~_\b4\8b_\84\9c\f49S\83\ff\97\f8\1f;(\f9\bd\8b\11/\ef\0f\98\05\de\cf~6m\1fm\nZf?FO\b7\t\cb\'\c7\ba\'u-\ea_\9e\f79\07={\f1\e5\eb\b1_\fbk\ea\92R\8aF0\03V\08]\8d\1f \bc\cf\f0\abk{\fca\91\e3\a9\1d6\f4\9a_\85\99e\08\1b\e6^\80\d8\ff\8d@h\a0\14W\15\06\061\'sM")
 (data $22 (i32.const 8460) "<")
 (data $22.1 (i32.const 8472) "\02\00\00\00$\00\00\00~\00l\00i\00b\00/\00t\00y\00p\00e\00d\00a\00r\00r\00a\00y\00.\00t\00s")
 (data $23 (i32.const 8524) ",")
 (data $23.1 (i32.const 8536) "\01\00\00\00\10\00\00\00\01\00\00\00\ff\ff\ff\ff")
 (data $24 (i32.const 8572) ",")
 (data $24.1 (i32.const 8584) "\01\00\00\00\10")
 (data $24.2 (i32.const 8600) "\01\00\00\00\ff\ff\ff\ff")
 (data $25 (i32.const 8624) "\0b\00\00\00 \00\00\00 \00\00\00 \00\00\00\00\00\00\00 \00\00\00 \00\00\00\02\t\00\00\02A\00\00A\00\00\00\01\t\00\00\01\01")
 (export "ALPHA_ARRAY_ID" (global $assembly/index/ALPHA_ARRAY_ID))
 (export "createBuffer" (func $assembly/index/createBuffer))
 (export "applyCameraRaw" (func $assembly/camera_raw/applyCameraRaw))
 (export "generateThumbnail" (func $assembly/camera_raw/generateThumbnail))
 (export "chromatic" (func $assembly/filters/chromatic))
 (export "wave" (func $assembly/filters/wave))
 (export "twist" (func $assembly/filters/twist))
 (export "pinch" (func $assembly/filters/pinch))
 (export "vignette" (func $assembly/filters/vignette))
 (export "adjustBCS" (func $assembly/filters/adjustBCS))
 (export "invert" (func $assembly/filters/invert))
 (export "grayscale" (func $assembly/filters/grayscale))
 (export "posterize" (func $assembly/filters/posterize))
 (export "boxBlur" (func $assembly/filters/boxBlur))
 (export "crystallize" (func $assembly/filters/crystallize))
 (export "softglow" (func $assembly/filters/softglow))
 (export "resize" (func $assembly/filters/resize))
 (export "orderedDither" (func $assembly/filters/orderedDither))
 (export "pixelate" (func $assembly/filters/pixelate))
 (export "sepia" (func $assembly/filters/sepia))
 (export "exposure" (func $assembly/filters/exposure))
 (export "halftone" (func $assembly/filters/halftone))
 (export "edgeDetect" (func $assembly/filters/edgeDetect))
 (export "scanlines" (func $assembly/filters/scanlines))
 (export "blendMask" (func $assembly/filters/blendMask))
 (export "buildDynamicMask" (func $assembly/filters/buildDynamicMask))
 (export "applyLuminanceMask" (func $assembly/filters/applyLuminanceMask))
 (export "similarColor" (func $assembly/filters/similarColor))
 (export "colorMatch" (func $assembly/filters/colorMatch))
 (export "grayscaleAlpha" (func $assembly/filters/grayscaleAlpha))
 (export "getMaskOutlineSegments" (func $assembly/filters/getMaskOutlineSegments))
 (export "magicWand" (func $assembly/filters/magicWand))
 (export "pointDistance" (func $assembly/vector/pointDistance))
 (export "perpendicularDistance" (func $assembly/vector/perpendicularDistance))
 (export "isPointOnSegment" (func $assembly/vector/isPointOnSegment))
 (export "getCubicBezierPoint" (func $assembly/vector/getCubicBezierPoint))
 (export "oilPainting" (func $assembly/pdn_effects/oilPainting))
 (export "relief" (func $assembly/pdn_effects/relief))
 (export "frostedGlass" (func $assembly/pdn_effects/frostedGlass))
 (export "redEyeRemove" (func $assembly/pdn_effects/redEyeRemove))
 (export "memory" (memory $0))
 (start $~start)
 (func $~lib/rt/itcms/visitRoots
  (local $0 i32)
  (local $1 i32)
  i32.const 1248
  call $~lib/rt/itcms/__visit
  i32.const 2016
  call $~lib/rt/itcms/__visit
  i32.const 1056
  call $~lib/rt/itcms/__visit
  global.get $assembly/filters/BAYER_MATRIX
  local.tee $0
  if
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $assembly/math/_hsv
  local.tee $0
  if
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $assembly/math/_rgb
  local.tee $0
  if
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $~lib/rt/itcms/pinSpace
  local.tee $1
  i32.load offset=4
  i32.const -4
  i32.and
  local.set $0
  loop $while-continue|0
   local.get $0
   local.get $1
   i32.ne
   if
    local.get $0
    i32.load offset=4
    i32.const 3
    i32.and
    i32.const 3
    i32.ne
    if
     i32.const 0
     i32.const 1120
     i32.const 160
     i32.const 16
     call $~lib/builtins/abort
     unreachable
    end
    local.get $0
    i32.const 20
    i32.add
    call $~lib/rt/__visit_members
    local.get $0
    i32.load offset=4
    i32.const -4
    i32.and
    local.set $0
    br $while-continue|0
   end
  end
 )
 (func $~lib/rt/itcms/Object#makeGray (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  local.get $0
  global.get $~lib/rt/itcms/iter
  i32.eq
  if
   local.get $0
   i32.load offset=8
   local.tee $1
   i32.eqz
   if
    i32.const 0
    i32.const 1120
    i32.const 148
    i32.const 30
    call $~lib/builtins/abort
    unreachable
   end
   local.get $1
   global.set $~lib/rt/itcms/iter
  end
  block $__inlined_func$~lib/rt/itcms/Object#unlink$214
   local.get $0
   i32.load offset=4
   i32.const -4
   i32.and
   local.tee $1
   i32.eqz
   if
    local.get $0
    i32.load offset=8
    i32.eqz
    local.get $0
    i32.const 41440
    i32.lt_u
    i32.and
    i32.eqz
    if
     i32.const 0
     i32.const 1120
     i32.const 128
     i32.const 18
     call $~lib/builtins/abort
     unreachable
    end
    br $__inlined_func$~lib/rt/itcms/Object#unlink$214
   end
   local.get $0
   i32.load offset=8
   local.tee $2
   i32.eqz
   if
    i32.const 0
    i32.const 1120
    i32.const 132
    i32.const 16
    call $~lib/builtins/abort
    unreachable
   end
   local.get $1
   local.get $2
   i32.store offset=8
   local.get $2
   local.get $1
   local.get $2
   i32.load offset=4
   i32.const 3
   i32.and
   i32.or
   i32.store offset=4
  end
  global.get $~lib/rt/itcms/toSpace
  local.set $2
  local.get $0
  i32.load offset=12
  local.tee $1
  i32.const 2
  i32.le_u
  if (result i32)
   i32.const 1
  else
   local.get $1
   i32.const 8624
   i32.load
   i32.gt_u
   if
    i32.const 1248
    i32.const 1312
    i32.const 21
    i32.const 28
    call $~lib/builtins/abort
    unreachable
   end
   local.get $1
   i32.const 2
   i32.shl
   i32.const 8628
   i32.add
   i32.load
   i32.const 32
   i32.and
  end
  local.set $3
  local.get $2
  i32.load offset=8
  local.set $1
  local.get $0
  global.get $~lib/rt/itcms/white
  i32.eqz
  i32.const 2
  local.get $3
  select
  local.get $2
  i32.or
  i32.store offset=4
  local.get $0
  local.get $1
  i32.store offset=8
  local.get $1
  local.get $0
  local.get $1
  i32.load offset=4
  i32.const 3
  i32.and
  i32.or
  i32.store offset=4
  local.get $2
  local.get $0
  i32.store offset=8
 )
 (func $~lib/rt/itcms/__visit (param $0 i32)
  local.get $0
  i32.eqz
  if
   return
  end
  global.get $~lib/rt/itcms/white
  local.get $0
  i32.const 20
  i32.sub
  local.tee $0
  i32.load offset=4
  i32.const 3
  i32.and
  i32.eq
  if
   local.get $0
   call $~lib/rt/itcms/Object#makeGray
   global.get $~lib/rt/itcms/visitCount
   i32.const 1
   i32.add
   global.set $~lib/rt/itcms/visitCount
  end
 )
 (func $~lib/rt/tlsf/removeBlock (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  local.get $1
  i32.load
  local.tee $3
  i32.const 1
  i32.and
  i32.eqz
  if
   i32.const 0
   i32.const 1392
   i32.const 268
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  i32.const -4
  i32.and
  local.tee $3
  i32.const 12
  i32.lt_u
  if
   i32.const 0
   i32.const 1392
   i32.const 270
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $3
  i32.const 256
  i32.lt_u
  if (result i32)
   local.get $3
   i32.const 4
   i32.shr_u
  else
   i32.const 31
   i32.const 1073741820
   local.get $3
   local.get $3
   i32.const 1073741820
   i32.ge_u
   select
   local.tee $3
   i32.clz
   i32.sub
   local.tee $4
   i32.const 7
   i32.sub
   local.set $2
   local.get $3
   local.get $4
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 16
   i32.xor
  end
  local.tee $3
  i32.const 16
  i32.lt_u
  local.get $2
  i32.const 23
  i32.lt_u
  i32.and
  i32.eqz
  if
   i32.const 0
   i32.const 1392
   i32.const 284
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  i32.load offset=8
  local.set $5
  local.get $1
  i32.load offset=4
  local.tee $4
  if
   local.get $4
   local.get $5
   i32.store offset=8
  end
  local.get $5
  if
   local.get $5
   local.get $4
   i32.store offset=4
  end
  local.get $1
  local.get $0
  local.get $2
  i32.const 4
  i32.shl
  local.get $3
  i32.add
  i32.const 2
  i32.shl
  i32.add
  local.tee $1
  i32.load offset=96
  i32.eq
  if
   local.get $1
   local.get $5
   i32.store offset=96
   local.get $5
   i32.eqz
   if
    local.get $0
    local.get $2
    i32.const 2
    i32.shl
    i32.add
    local.tee $1
    i32.load offset=4
    i32.const -2
    local.get $3
    i32.rotl
    i32.and
    local.set $3
    local.get $1
    local.get $3
    i32.store offset=4
    local.get $3
    i32.eqz
    if
     local.get $0
     local.get $0
     i32.load
     i32.const -2
     local.get $2
     i32.rotl
     i32.and
     i32.store
    end
   end
  end
 )
 (func $~lib/rt/tlsf/insertBlock (param $0 i32) (param $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  local.get $1
  i32.eqz
  if
   i32.const 0
   i32.const 1392
   i32.const 201
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  i32.load
  local.tee $3
  i32.const 1
  i32.and
  i32.eqz
  if
   i32.const 0
   i32.const 1392
   i32.const 203
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  i32.const 4
  i32.add
  local.get $1
  i32.load
  i32.const -4
  i32.and
  i32.add
  local.tee $4
  i32.load
  local.tee $2
  i32.const 1
  i32.and
  if
   local.get $0
   local.get $4
   call $~lib/rt/tlsf/removeBlock
   local.get $1
   local.get $3
   i32.const 4
   i32.add
   local.get $2
   i32.const -4
   i32.and
   i32.add
   local.tee $3
   i32.store
   local.get $1
   i32.const 4
   i32.add
   local.get $1
   i32.load
   i32.const -4
   i32.and
   i32.add
   local.tee $4
   i32.load
   local.set $2
  end
  local.get $3
  i32.const 2
  i32.and
  if
   local.get $1
   i32.const 4
   i32.sub
   i32.load
   local.tee $1
   i32.load
   local.tee $6
   i32.const 1
   i32.and
   i32.eqz
   if
    i32.const 0
    i32.const 1392
    i32.const 221
    i32.const 16
    call $~lib/builtins/abort
    unreachable
   end
   local.get $0
   local.get $1
   call $~lib/rt/tlsf/removeBlock
   local.get $1
   local.get $6
   i32.const 4
   i32.add
   local.get $3
   i32.const -4
   i32.and
   i32.add
   local.tee $3
   i32.store
  end
  local.get $4
  local.get $2
  i32.const 2
  i32.or
  i32.store
  local.get $3
  i32.const -4
  i32.and
  local.tee $2
  i32.const 12
  i32.lt_u
  if
   i32.const 0
   i32.const 1392
   i32.const 233
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $4
  local.get $1
  i32.const 4
  i32.add
  local.get $2
  i32.add
  i32.ne
  if
   i32.const 0
   i32.const 1392
   i32.const 234
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $4
  i32.const 4
  i32.sub
  local.get $1
  i32.store
  local.get $2
  i32.const 256
  i32.lt_u
  if (result i32)
   local.get $2
   i32.const 4
   i32.shr_u
  else
   i32.const 31
   i32.const 1073741820
   local.get $2
   local.get $2
   i32.const 1073741820
   i32.ge_u
   select
   local.tee $2
   i32.clz
   i32.sub
   local.tee $3
   i32.const 7
   i32.sub
   local.set $5
   local.get $2
   local.get $3
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 16
   i32.xor
  end
  local.tee $2
  i32.const 16
  i32.lt_u
  local.get $5
  i32.const 23
  i32.lt_u
  i32.and
  i32.eqz
  if
   i32.const 0
   i32.const 1392
   i32.const 251
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  local.get $5
  i32.const 4
  i32.shl
  local.get $2
  i32.add
  i32.const 2
  i32.shl
  i32.add
  i32.load offset=96
  local.set $3
  local.get $1
  i32.const 0
  i32.store offset=4
  local.get $1
  local.get $3
  i32.store offset=8
  local.get $3
  if
   local.get $3
   local.get $1
   i32.store offset=4
  end
  local.get $0
  local.get $5
  i32.const 4
  i32.shl
  local.get $2
  i32.add
  i32.const 2
  i32.shl
  i32.add
  local.get $1
  i32.store offset=96
  local.get $0
  local.get $0
  i32.load
  i32.const 1
  local.get $5
  i32.shl
  i32.or
  i32.store
  local.get $0
  local.get $5
  i32.const 2
  i32.shl
  i32.add
  local.tee $0
  local.get $0
  i32.load offset=4
  i32.const 1
  local.get $2
  i32.shl
  i32.or
  i32.store offset=4
 )
 (func $~lib/rt/tlsf/addMemory (param $0 i32) (param $1 i32) (param $2 i64)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  local.get $2
  local.get $1
  i64.extend_i32_u
  i64.lt_u
  if
   i32.const 0
   i32.const 1392
   i32.const 382
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $1
  i32.const 19
  i32.add
  i32.const -16
  i32.and
  i32.const 4
  i32.sub
  local.set $1
  local.get $0
  i32.load offset=1568
  local.tee $3
  if
   local.get $3
   i32.const 4
   i32.add
   local.get $1
   i32.gt_u
   if
    i32.const 0
    i32.const 1392
    i32.const 389
    i32.const 16
    call $~lib/builtins/abort
    unreachable
   end
   local.get $3
   local.get $1
   i32.const 16
   i32.sub
   local.tee $5
   i32.eq
   if
    local.get $3
    i32.load
    local.set $4
    local.get $5
    local.set $1
   end
  else
   local.get $0
   i32.const 1572
   i32.add
   local.get $1
   i32.gt_u
   if
    i32.const 0
    i32.const 1392
    i32.const 402
    i32.const 5
    call $~lib/builtins/abort
    unreachable
   end
  end
  local.get $2
  i32.wrap_i64
  i32.const -16
  i32.and
  local.get $1
  i32.sub
  local.tee $3
  i32.const 20
  i32.lt_u
  if
   return
  end
  local.get $1
  local.get $4
  i32.const 2
  i32.and
  local.get $3
  i32.const 8
  i32.sub
  local.tee $3
  i32.const 1
  i32.or
  i32.or
  i32.store
  local.get $1
  i32.const 0
  i32.store offset=4
  local.get $1
  i32.const 0
  i32.store offset=8
  local.get $1
  i32.const 4
  i32.add
  local.get $3
  i32.add
  local.tee $3
  i32.const 2
  i32.store
  local.get $0
  local.get $3
  i32.store offset=1568
  local.get $0
  local.get $1
  call $~lib/rt/tlsf/insertBlock
 )
 (func $~lib/rt/tlsf/initialize
  (local $0 i32)
  (local $1 i32)
  memory.size
  local.tee $1
  i32.const 0
  i32.le_s
  if (result i32)
   i32.const 1
   local.get $1
   i32.sub
   memory.grow
   i32.const 0
   i32.lt_s
  else
   i32.const 0
  end
  if
   unreachable
  end
  i32.const 41440
  i32.const 0
  i32.store
  i32.const 43008
  i32.const 0
  i32.store
  loop $for-loop|0
   local.get $0
   i32.const 23
   i32.lt_u
   if
    local.get $0
    i32.const 2
    i32.shl
    i32.const 41440
    i32.add
    i32.const 0
    i32.store offset=4
    i32.const 0
    local.set $1
    loop $for-loop|1
     local.get $1
     i32.const 16
     i32.lt_u
     if
      local.get $0
      i32.const 4
      i32.shl
      local.get $1
      i32.add
      i32.const 2
      i32.shl
      i32.const 41440
      i32.add
      i32.const 0
      i32.store offset=96
      local.get $1
      i32.const 1
      i32.add
      local.set $1
      br $for-loop|1
     end
    end
    local.get $0
    i32.const 1
    i32.add
    local.set $0
    br $for-loop|0
   end
  end
  i32.const 41440
  i32.const 43012
  memory.size
  i64.extend_i32_s
  i64.const 16
  i64.shl
  call $~lib/rt/tlsf/addMemory
  i32.const 41440
  global.set $~lib/rt/tlsf/ROOT
 )
 (func $~lib/rt/itcms/step (result i32)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  block $break|0
   block $case2|0
    block $case1|0
     block $case0|0
      global.get $~lib/rt/itcms/state
      br_table $case0|0 $case1|0 $case2|0 $break|0
     end
     i32.const 1
     global.set $~lib/rt/itcms/state
     i32.const 0
     global.set $~lib/rt/itcms/visitCount
     call $~lib/rt/itcms/visitRoots
     global.get $~lib/rt/itcms/toSpace
     global.set $~lib/rt/itcms/iter
     global.get $~lib/rt/itcms/visitCount
     return
    end
    global.get $~lib/rt/itcms/white
    i32.eqz
    local.set $1
    global.get $~lib/rt/itcms/iter
    i32.load offset=4
    i32.const -4
    i32.and
    local.set $0
    loop $while-continue|1
     local.get $0
     global.get $~lib/rt/itcms/toSpace
     i32.ne
     if
      local.get $0
      global.set $~lib/rt/itcms/iter
      local.get $1
      local.get $0
      i32.load offset=4
      local.tee $2
      i32.const 3
      i32.and
      i32.ne
      if
       local.get $0
       local.get $2
       i32.const -4
       i32.and
       local.get $1
       i32.or
       i32.store offset=4
       i32.const 0
       global.set $~lib/rt/itcms/visitCount
       local.get $0
       i32.const 20
       i32.add
       call $~lib/rt/__visit_members
       global.get $~lib/rt/itcms/visitCount
       return
      end
      local.get $0
      i32.load offset=4
      i32.const -4
      i32.and
      local.set $0
      br $while-continue|1
     end
    end
    i32.const 0
    global.set $~lib/rt/itcms/visitCount
    call $~lib/rt/itcms/visitRoots
    global.get $~lib/rt/itcms/toSpace
    global.get $~lib/rt/itcms/iter
    i32.load offset=4
    i32.const -4
    i32.and
    i32.eq
    if
     global.get $~lib/memory/__stack_pointer
     local.set $0
     loop $while-continue|0
      local.get $0
      i32.const 41440
      i32.lt_u
      if
       local.get $0
       i32.load
       call $~lib/rt/itcms/__visit
       local.get $0
       i32.const 4
       i32.add
       local.set $0
       br $while-continue|0
      end
     end
     global.get $~lib/rt/itcms/iter
     i32.load offset=4
     i32.const -4
     i32.and
     local.set $0
     loop $while-continue|2
      local.get $0
      global.get $~lib/rt/itcms/toSpace
      i32.ne
      if
       local.get $1
       local.get $0
       i32.load offset=4
       local.tee $2
       i32.const 3
       i32.and
       i32.ne
       if
        local.get $0
        local.get $2
        i32.const -4
        i32.and
        local.get $1
        i32.or
        i32.store offset=4
        local.get $0
        i32.const 20
        i32.add
        call $~lib/rt/__visit_members
       end
       local.get $0
       i32.load offset=4
       i32.const -4
       i32.and
       local.set $0
       br $while-continue|2
      end
     end
     global.get $~lib/rt/itcms/fromSpace
     local.set $0
     global.get $~lib/rt/itcms/toSpace
     global.set $~lib/rt/itcms/fromSpace
     local.get $0
     global.set $~lib/rt/itcms/toSpace
     local.get $1
     global.set $~lib/rt/itcms/white
     local.get $0
     i32.load offset=4
     i32.const -4
     i32.and
     global.set $~lib/rt/itcms/iter
     i32.const 2
     global.set $~lib/rt/itcms/state
    end
    global.get $~lib/rt/itcms/visitCount
    return
   end
   global.get $~lib/rt/itcms/iter
   local.tee $0
   global.get $~lib/rt/itcms/toSpace
   i32.ne
   if
    local.get $0
    i32.load offset=4
    local.tee $1
    i32.const -4
    i32.and
    global.set $~lib/rt/itcms/iter
    global.get $~lib/rt/itcms/white
    i32.eqz
    local.get $1
    i32.const 3
    i32.and
    i32.ne
    if
     i32.const 0
     i32.const 1120
     i32.const 229
     i32.const 20
     call $~lib/builtins/abort
     unreachable
    end
    local.get $0
    i32.const 41440
    i32.lt_u
    if
     local.get $0
     i32.const 0
     i32.store offset=4
     local.get $0
     i32.const 0
     i32.store offset=8
    else
     global.get $~lib/rt/itcms/total
     local.get $0
     i32.load
     i32.const -4
     i32.and
     i32.const 4
     i32.add
     i32.sub
     global.set $~lib/rt/itcms/total
     local.get $0
     i32.const 4
     i32.add
     local.tee $0
     i32.const 41440
     i32.ge_u
     if
      global.get $~lib/rt/tlsf/ROOT
      i32.eqz
      if
       call $~lib/rt/tlsf/initialize
      end
      global.get $~lib/rt/tlsf/ROOT
      local.get $0
      i32.const 4
      i32.sub
      local.set $2
      local.get $0
      i32.const 15
      i32.and
      i32.const 1
      local.get $0
      select
      if (result i32)
       i32.const 1
      else
       local.get $2
       i32.load
       i32.const 1
       i32.and
      end
      if
       i32.const 0
       i32.const 1392
       i32.const 562
       i32.const 3
       call $~lib/builtins/abort
       unreachable
      end
      local.get $2
      local.get $2
      i32.load
      i32.const 1
      i32.or
      i32.store
      local.get $2
      call $~lib/rt/tlsf/insertBlock
     end
    end
    i32.const 10
    return
   end
   global.get $~lib/rt/itcms/toSpace
   global.get $~lib/rt/itcms/toSpace
   i32.store offset=4
   global.get $~lib/rt/itcms/toSpace
   global.get $~lib/rt/itcms/toSpace
   i32.store offset=8
   i32.const 0
   global.set $~lib/rt/itcms/state
  end
  i32.const 0
 )
 (func $~lib/rt/tlsf/searchBlock (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  local.get $1
  i32.const 256
  i32.lt_u
  if
   local.get $1
   i32.const 4
   i32.shr_u
   local.set $1
  else
   local.get $1
   i32.const 536870910
   i32.lt_u
   if
    local.get $1
    i32.const 1
    i32.const 27
    local.get $1
    i32.clz
    i32.sub
    i32.shl
    i32.add
    i32.const 1
    i32.sub
    local.set $1
   end
   local.get $1
   i32.const 31
   local.get $1
   i32.clz
   i32.sub
   local.tee $2
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 16
   i32.xor
   local.set $1
   local.get $2
   i32.const 7
   i32.sub
   local.set $2
  end
  local.get $1
  i32.const 16
  i32.lt_u
  local.get $2
  i32.const 23
  i32.lt_u
  i32.and
  i32.eqz
  if
   i32.const 0
   i32.const 1392
   i32.const 334
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  local.get $2
  i32.const 2
  i32.shl
  i32.add
  i32.load offset=4
  i32.const -1
  local.get $1
  i32.shl
  i32.and
  local.tee $1
  if (result i32)
   local.get $0
   local.get $1
   i32.ctz
   local.get $2
   i32.const 4
   i32.shl
   i32.add
   i32.const 2
   i32.shl
   i32.add
   i32.load offset=96
  else
   local.get $0
   i32.load
   i32.const -1
   local.get $2
   i32.const 1
   i32.add
   i32.shl
   i32.and
   local.tee $1
   if (result i32)
    local.get $0
    local.get $1
    i32.ctz
    local.tee $1
    i32.const 2
    i32.shl
    i32.add
    i32.load offset=4
    local.tee $2
    i32.eqz
    if
     i32.const 0
     i32.const 1392
     i32.const 347
     i32.const 18
     call $~lib/builtins/abort
     unreachable
    end
    local.get $0
    local.get $2
    i32.ctz
    local.get $1
    i32.const 4
    i32.shl
    i32.add
    i32.const 2
    i32.shl
    i32.add
    i32.load offset=96
   else
    i32.const 0
   end
  end
 )
 (func $~lib/rt/itcms/__new (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  local.get $0
  i32.const 1073741804
  i32.ge_u
  if
   i32.const 1056
   i32.const 1120
   i32.const 261
   i32.const 31
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/rt/itcms/total
  global.get $~lib/rt/itcms/threshold
  i32.ge_u
  if
   block $__inlined_func$~lib/rt/itcms/interrupt$69
    i32.const 2048
    local.set $2
    loop $do-loop|0
     local.get $2
     call $~lib/rt/itcms/step
     i32.sub
     local.set $2
     global.get $~lib/rt/itcms/state
     i32.eqz
     if
      global.get $~lib/rt/itcms/total
      i32.const 1
      i32.shl
      i32.const 1024
      i32.add
      global.set $~lib/rt/itcms/threshold
      br $__inlined_func$~lib/rt/itcms/interrupt$69
     end
     local.get $2
     i32.const 0
     i32.gt_s
     br_if $do-loop|0
    end
    global.get $~lib/rt/itcms/total
    global.get $~lib/rt/itcms/total
    global.get $~lib/rt/itcms/threshold
    i32.sub
    i32.const 1024
    i32.lt_u
    i32.const 10
    i32.shl
    i32.add
    global.set $~lib/rt/itcms/threshold
   end
  end
  global.get $~lib/rt/tlsf/ROOT
  i32.eqz
  if
   call $~lib/rt/tlsf/initialize
  end
  global.get $~lib/rt/tlsf/ROOT
  local.set $4
  local.get $0
  i32.const 16
  i32.add
  local.tee $2
  i32.const 1073741820
  i32.gt_u
  if
   i32.const 1056
   i32.const 1392
   i32.const 461
   i32.const 29
   call $~lib/builtins/abort
   unreachable
  end
  local.get $4
  local.get $2
  i32.const 12
  i32.le_u
  if (result i32)
   i32.const 12
  else
   local.get $2
   i32.const 19
   i32.add
   i32.const -16
   i32.and
   i32.const 4
   i32.sub
  end
  local.tee $5
  call $~lib/rt/tlsf/searchBlock
  local.tee $2
  i32.eqz
  if
   memory.size
   local.tee $2
   local.get $5
   i32.const 256
   i32.ge_u
   if (result i32)
    local.get $5
    i32.const 536870910
    i32.lt_u
    if (result i32)
     local.get $5
     i32.const 1
     i32.const 27
     local.get $5
     i32.clz
     i32.sub
     i32.shl
     i32.add
     i32.const 1
     i32.sub
    else
     local.get $5
    end
   else
    local.get $5
   end
   i32.const 4
   local.get $4
   i32.load offset=1568
   local.get $2
   i32.const 16
   i32.shl
   i32.const 4
   i32.sub
   i32.ne
   i32.shl
   i32.add
   i32.const 65535
   i32.add
   i32.const -65536
   i32.and
   i32.const 16
   i32.shr_u
   local.tee $3
   local.get $2
   local.get $3
   i32.gt_s
   select
   memory.grow
   i32.const 0
   i32.lt_s
   if
    local.get $3
    memory.grow
    i32.const 0
    i32.lt_s
    if
     unreachable
    end
   end
   local.get $4
   local.get $2
   i32.const 16
   i32.shl
   memory.size
   i64.extend_i32_s
   i64.const 16
   i64.shl
   call $~lib/rt/tlsf/addMemory
   local.get $4
   local.get $5
   call $~lib/rt/tlsf/searchBlock
   local.tee $2
   i32.eqz
   if
    i32.const 0
    i32.const 1392
    i32.const 499
    i32.const 16
    call $~lib/builtins/abort
    unreachable
   end
  end
  local.get $5
  local.get $2
  i32.load
  i32.const -4
  i32.and
  i32.gt_u
  if
   i32.const 0
   i32.const 1392
   i32.const 501
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $4
  local.get $2
  call $~lib/rt/tlsf/removeBlock
  local.get $2
  i32.load
  local.set $6
  local.get $5
  i32.const 4
  i32.add
  i32.const 15
  i32.and
  if
   i32.const 0
   i32.const 1392
   i32.const 361
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $6
  i32.const -4
  i32.and
  local.get $5
  i32.sub
  local.tee $3
  i32.const 16
  i32.ge_u
  if
   local.get $2
   local.get $5
   local.get $6
   i32.const 2
   i32.and
   i32.or
   i32.store
   local.get $2
   i32.const 4
   i32.add
   local.get $5
   i32.add
   local.tee $5
   local.get $3
   i32.const 4
   i32.sub
   i32.const 1
   i32.or
   i32.store
   local.get $4
   local.get $5
   call $~lib/rt/tlsf/insertBlock
  else
   local.get $2
   local.get $6
   i32.const -2
   i32.and
   i32.store
   local.get $2
   i32.const 4
   i32.add
   local.get $2
   i32.load
   i32.const -4
   i32.and
   i32.add
   local.tee $3
   local.get $3
   i32.load
   i32.const -3
   i32.and
   i32.store
  end
  local.get $2
  local.get $1
  i32.store offset=12
  local.get $2
  local.get $0
  i32.store offset=16
  global.get $~lib/rt/itcms/fromSpace
  local.tee $1
  i32.load offset=8
  local.set $3
  local.get $2
  local.get $1
  global.get $~lib/rt/itcms/white
  i32.or
  i32.store offset=4
  local.get $2
  local.get $3
  i32.store offset=8
  local.get $3
  local.get $2
  local.get $3
  i32.load offset=4
  i32.const 3
  i32.and
  i32.or
  i32.store offset=4
  local.get $1
  local.get $2
  i32.store offset=8
  global.get $~lib/rt/itcms/total
  local.get $2
  i32.load
  i32.const -4
  i32.and
  i32.const 4
  i32.add
  i32.add
  global.set $~lib/rt/itcms/total
  local.get $2
  i32.const 20
  i32.add
  local.tee $1
  i32.const 0
  local.get $0
  memory.fill
  local.get $1
 )
 (func $~lib/rt/itcms/__link (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  local.get $1
  i32.eqz
  if
   return
  end
  local.get $0
  i32.eqz
  if
   i32.const 0
   i32.const 1120
   i32.const 295
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/rt/itcms/white
  local.get $1
  i32.const 20
  i32.sub
  local.tee $1
  i32.load offset=4
  i32.const 3
  i32.and
  i32.eq
  if
   local.get $0
   i32.const 20
   i32.sub
   local.tee $0
   i32.load offset=4
   i32.const 3
   i32.and
   local.tee $3
   global.get $~lib/rt/itcms/white
   i32.eqz
   i32.eq
   if
    local.get $0
    local.get $1
    local.get $2
    select
    call $~lib/rt/itcms/Object#makeGray
   else
    global.get $~lib/rt/itcms/state
    i32.const 1
    i32.eq
    local.get $3
    i32.const 3
    i32.eq
    i32.and
    if
     local.get $1
     call $~lib/rt/itcms/Object#makeGray
    end
   end
  end
 )
 (func $assembly/index/createBuffer (param $0 i32) (result i32)
  local.get $0
  call $~lib/typedarray/Uint8Array#constructor
 )
 (func $~lib/math/NativeMath.pow (param $0 f64) (param $1 f64) (result f64)
  (local $2 i64)
  (local $3 i32)
  (local $4 i32)
  (local $5 i64)
  (local $6 i64)
  (local $7 f64)
  (local $8 f64)
  (local $9 f64)
  (local $10 f64)
  (local $11 i64)
  (local $12 i64)
  (local $13 f64)
  (local $14 f64)
  (local $15 f64)
  (local $16 f64)
  (local $17 f64)
  (local $18 i32)
  local.get $1
  f64.abs
  f64.const 2
  f64.le
  if
   local.get $1
   f64.const 2
   f64.eq
   if
    local.get $0
    local.get $0
    f64.mul
    return
   end
   local.get $1
   f64.const 0.5
   f64.eq
   if
    local.get $0
    f64.sqrt
    f64.abs
    f64.const inf
    local.get $0
    f64.const -inf
    f64.ne
    select
    return
   end
   local.get $1
   f64.const -1
   f64.eq
   if
    f64.const 1
    local.get $0
    f64.div
    return
   end
   local.get $1
   f64.const 1
   f64.eq
   if
    local.get $0
    return
   end
   local.get $1
   f64.const 0
   f64.eq
   if
    f64.const 1
    return
   end
  end
  block $~lib/util/math/pow_lut|inlined.0 (result f64)
   local.get $1
   i64.reinterpret_f64
   local.tee $11
   i64.const 52
   i64.shr_u
   local.set $6
   local.get $0
   i64.reinterpret_f64
   local.tee $2
   i64.const 52
   i64.shr_u
   local.tee $5
   i64.const 1
   i64.sub
   i64.const 2046
   i64.ge_u
   if (result i32)
    i32.const 1
   else
    local.get $6
    i64.const 2047
    i64.and
    i64.const 958
    i64.sub
    i64.const 128
    i64.ge_u
   end
   if
    local.get $11
    i64.const 1
    i64.shl
    local.tee $12
    i64.const 1
    i64.sub
    i64.const -9007199254740993
    i64.ge_u
    if
     f64.const 1
     local.get $12
     i64.eqz
     br_if $~lib/util/math/pow_lut|inlined.0
     drop
     f64.const nan:0x8000000000000
     local.get $2
     i64.const 4607182418800017408
     i64.eq
     br_if $~lib/util/math/pow_lut|inlined.0
     drop
     local.get $0
     local.get $1
     f64.add
     local.get $12
     i64.const -9007199254740992
     i64.gt_u
     local.get $2
     i64.const 1
     i64.shl
     local.tee $2
     i64.const -9007199254740992
     i64.gt_u
     i32.or
     br_if $~lib/util/math/pow_lut|inlined.0
     drop
     f64.const nan:0x8000000000000
     local.get $2
     i64.const 9214364837600034816
     i64.eq
     br_if $~lib/util/math/pow_lut|inlined.0
     drop
     f64.const 0
     local.get $11
     i64.const 63
     i64.shr_u
     i64.eqz
     local.get $2
     i64.const 9214364837600034816
     i64.lt_u
     i32.eq
     br_if $~lib/util/math/pow_lut|inlined.0
     drop
     local.get $1
     local.get $1
     f64.mul
     br $~lib/util/math/pow_lut|inlined.0
    end
    local.get $2
    i64.const 1
    i64.shl
    i64.const 1
    i64.sub
    i64.const -9007199254740993
    i64.ge_u
    if
     f64.const 1
     local.get $0
     local.get $0
     f64.mul
     local.tee $0
     f64.neg
     local.get $0
     local.get $2
     i64.const 63
     i64.shr_u
     i32.wrap_i64
     if (result i32)
      block $~lib/util/math/checkint|inlined.0 (result i32)
       i32.const 0
       local.get $11
       i64.const 52
       i64.shr_u
       i64.const 2047
       i64.and
       local.tee $2
       i64.const 1023
       i64.lt_u
       br_if $~lib/util/math/checkint|inlined.0
       drop
       i32.const 2
       local.get $2
       i64.const 1075
       i64.gt_u
       br_if $~lib/util/math/checkint|inlined.0
       drop
       i32.const 0
       local.get $11
       i64.const 1
       i64.const 1075
       local.get $2
       i64.sub
       i64.shl
       local.tee $2
       i64.const 1
       i64.sub
       i64.and
       i64.const 0
       i64.ne
       br_if $~lib/util/math/checkint|inlined.0
       drop
       i32.const 1
       local.get $2
       local.get $11
       i64.and
       i64.const 0
       i64.ne
       br_if $~lib/util/math/checkint|inlined.0
       drop
       i32.const 2
      end
      i32.const 1
      i32.eq
     else
      i32.const 0
     end
     select
     local.tee $0
     f64.div
     local.get $0
     local.get $11
     i64.const 0
     i64.lt_s
     select
     br $~lib/util/math/pow_lut|inlined.0
    end
    local.get $2
    i64.const 0
    i64.lt_s
    if
     block $~lib/util/math/checkint|inlined.1 (result i32)
      i32.const 0
      local.get $11
      i64.const 52
      i64.shr_u
      i64.const 2047
      i64.and
      local.tee $12
      i64.const 1023
      i64.lt_u
      br_if $~lib/util/math/checkint|inlined.1
      drop
      i32.const 2
      local.get $12
      i64.const 1075
      i64.gt_u
      br_if $~lib/util/math/checkint|inlined.1
      drop
      i32.const 0
      local.get $11
      i64.const 1
      i64.const 1075
      local.get $12
      i64.sub
      i64.shl
      local.tee $12
      i64.const 1
      i64.sub
      i64.and
      i64.const 0
      i64.ne
      br_if $~lib/util/math/checkint|inlined.1
      drop
      i32.const 1
      local.get $11
      local.get $12
      i64.and
      i64.const 0
      i64.ne
      br_if $~lib/util/math/checkint|inlined.1
      drop
      i32.const 2
     end
     local.tee $3
     i32.eqz
     if
      local.get $0
      local.get $0
      f64.sub
      local.tee $0
      local.get $0
      f64.div
      br $~lib/util/math/pow_lut|inlined.0
     end
     local.get $5
     i64.const 2047
     i64.and
     local.set $5
     i32.const 262144
     i32.const 0
     local.get $3
     i32.const 1
     i32.eq
     select
     local.set $4
     local.get $2
     i64.const 9223372036854775807
     i64.and
     local.set $2
    end
    local.get $6
    i64.const 2047
    i64.and
    local.tee $12
    i64.const 958
    i64.sub
    i64.const 128
    i64.ge_u
    if
     f64.const 1
     local.get $2
     i64.const 4607182418800017408
     i64.eq
     br_if $~lib/util/math/pow_lut|inlined.0
     drop
     f64.const 1
     local.get $12
     i64.const 958
     i64.lt_u
     br_if $~lib/util/math/pow_lut|inlined.0
     drop
     f64.const inf
     f64.const 0
     local.get $6
     i64.const 2048
     i64.lt_u
     local.get $2
     i64.const 4607182418800017408
     i64.gt_u
     i32.eq
     select
     br $~lib/util/math/pow_lut|inlined.0
    end
    local.get $5
    i64.eqz
    if
     local.get $0
     f64.const 4503599627370496
     f64.mul
     i64.reinterpret_f64
     i64.const 9223372036854775807
     i64.and
     i64.const 234187180623265792
     i64.sub
     local.set $2
    end
   end
   local.get $2
   local.get $2
   i64.const 4604531861337669632
   i64.sub
   local.tee $2
   i64.const -4503599627370496
   i64.and
   i64.sub
   local.tee $5
   i64.const 2147483648
   i64.add
   i64.const -4294967296
   i64.and
   f64.reinterpret_i64
   local.tee $7
   local.get $2
   i64.const 45
   i64.shr_u
   i64.const 127
   i64.and
   i32.wrap_i64
   i32.const 5
   i32.shl
   i32.const 2112
   i32.add
   local.tee $3
   f64.load
   local.tee $8
   f64.mul
   f64.const -1
   f64.add
   local.set $9
   local.get $2
   i64.const 52
   i64.shr_s
   f64.convert_i64_s
   local.tee $13
   f64.const 0.6931471805598903
   f64.mul
   local.get $3
   f64.load offset=16
   f64.add
   local.tee $0
   local.get $9
   local.get $5
   f64.reinterpret_i64
   local.get $7
   f64.sub
   local.get $8
   f64.mul
   local.tee $7
   f64.add
   local.tee $14
   f64.add
   local.set $15
   local.get $14
   local.get $14
   f64.const -0.5
   f64.mul
   local.tee $8
   f64.mul
   local.set $16
   local.get $15
   local.get $9
   local.get $9
   f64.const -0.5
   f64.mul
   local.tee $17
   f64.mul
   local.tee $9
   f64.add
   local.tee $10
   local.get $10
   local.get $13
   f64.const 5.497923018708371e-14
   f64.mul
   local.get $3
   f64.load offset=24
   f64.add
   local.get $0
   local.get $15
   f64.sub
   local.get $14
   f64.add
   f64.add
   local.get $7
   local.get $8
   local.get $17
   f64.add
   f64.mul
   f64.add
   local.get $15
   local.get $10
   f64.sub
   local.get $9
   f64.add
   f64.add
   local.get $14
   local.get $16
   f64.mul
   local.get $14
   f64.const 0.5000000000000007
   f64.mul
   f64.const -0.6666666666666679
   f64.add
   local.get $16
   local.get $14
   f64.const -0.6666666663487739
   f64.mul
   f64.const 0.7999999995323976
   f64.add
   local.get $16
   local.get $14
   f64.const 1.0000415263675542
   f64.mul
   f64.const -1.142909628459501
   f64.add
   f64.mul
   f64.add
   f64.mul
   f64.add
   f64.mul
   f64.add
   local.tee $0
   f64.add
   local.tee $7
   f64.sub
   local.get $0
   f64.add
   global.set $~lib/util/math/log_tail
   block $~lib/util/math/exp_inline|inlined.0 (result f64)
    local.get $11
    i64.const -134217728
    i64.and
    f64.reinterpret_i64
    local.tee $0
    local.get $7
    i64.reinterpret_f64
    i64.const -134217728
    i64.and
    f64.reinterpret_i64
    local.tee $8
    f64.mul
    local.tee $9
    i64.reinterpret_f64
    local.tee $2
    i64.const 52
    i64.shr_u
    i32.wrap_i64
    i32.const 2047
    i32.and
    local.tee $3
    i32.const 969
    i32.sub
    local.tee $18
    i32.const 63
    i32.ge_u
    if
     f64.const -1
     f64.const 1
     local.get $4
     select
     local.get $18
     i32.const -2147483648
     i32.ge_u
     br_if $~lib/util/math/exp_inline|inlined.0
     drop
     f64.const -0
     f64.const 0
     local.get $4
     select
     f64.const -inf
     f64.const inf
     local.get $4
     select
     local.get $2
     i64.const 0
     i64.lt_s
     select
     local.get $3
     i32.const 1033
     i32.ge_u
     br_if $~lib/util/math/exp_inline|inlined.0
     drop
     i32.const 0
     local.set $3
    end
    local.get $9
    f64.const 184.6649652337873
    f64.mul
    f64.const 6755399441055744
    f64.add
    local.tee $10
    i64.reinterpret_f64
    local.tee $2
    i64.const 127
    i64.and
    i64.const 1
    i64.shl
    i32.wrap_i64
    i32.const 3
    i32.shl
    i32.const 6208
    i32.add
    local.tee $18
    i64.load offset=8
    local.get $2
    local.get $4
    i64.extend_i32_u
    i64.add
    i64.const 45
    i64.shl
    i64.add
    local.set $5
    local.get $9
    local.get $10
    f64.const -6755399441055744
    f64.add
    local.tee $9
    f64.const -0.005415212348111709
    f64.mul
    f64.add
    local.get $9
    f64.const -1.2864023111638346e-14
    f64.mul
    f64.add
    local.get $1
    local.get $0
    f64.sub
    local.get $8
    f64.mul
    local.get $1
    local.get $7
    local.get $8
    f64.sub
    global.get $~lib/util/math/log_tail
    f64.add
    f64.mul
    f64.add
    f64.add
    local.tee $0
    local.get $0
    f64.mul
    local.set $1
    local.get $18
    f64.load
    local.get $0
    f64.add
    local.get $1
    local.get $0
    f64.const 0.16666666666665886
    f64.mul
    f64.const 0.49999999999996786
    f64.add
    f64.mul
    f64.add
    local.get $1
    local.get $1
    f64.mul
    local.get $0
    f64.const 0.008333335853059549
    f64.mul
    f64.const 0.0416666808410674
    f64.add
    f64.mul
    f64.add
    local.set $0
    local.get $3
    i32.eqz
    if
     block $~lib/util/math/specialcase|inlined.0 (result f64)
      local.get $2
      i64.const 2147483648
      i64.and
      i64.eqz
      if
       local.get $5
       i64.const 4544132024016830464
       i64.sub
       f64.reinterpret_i64
       local.tee $1
       local.get $1
       local.get $0
       f64.mul
       f64.add
       f64.const 5486124068793688683255936e279
       f64.mul
       br $~lib/util/math/specialcase|inlined.0
      end
      local.get $5
      i64.const 4602678819172646912
      i64.add
      local.tee $2
      f64.reinterpret_i64
      local.tee $1
      local.get $0
      f64.mul
      local.set $0
      local.get $1
      local.get $0
      f64.add
      local.tee $7
      f64.abs
      f64.const 1
      f64.lt
      if (result f64)
       f64.const 1
       local.get $7
       f64.copysign
       local.tee $8
       local.get $7
       f64.add
       local.tee $9
       local.get $8
       local.get $9
       f64.sub
       local.get $7
       f64.add
       local.get $1
       local.get $7
       f64.sub
       local.get $0
       f64.add
       f64.add
       f64.add
       local.get $8
       f64.sub
       local.tee $0
       f64.const 0
       f64.eq
       if (result f64)
        local.get $2
        i64.const -9223372036854775808
        i64.and
        f64.reinterpret_i64
       else
        local.get $0
       end
      else
       local.get $7
      end
      f64.const 2.2250738585072014e-308
      f64.mul
     end
     br $~lib/util/math/exp_inline|inlined.0
    end
    local.get $5
    f64.reinterpret_i64
    local.tee $1
    local.get $1
    local.get $0
    f64.mul
    f64.add
   end
  end
 )
 (func $assembly/camera_raw/generateThumbnail (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32)
  (local $6 i32)
  (local $7 f32)
  (local $8 f32)
  (local $9 i32)
  (local $10 i32)
  local.get $2
  f32.convert_i32_s
  local.get $4
  f32.convert_i32_s
  f32.div
  local.set $7
  local.get $3
  f32.convert_i32_s
  local.get $5
  f32.convert_i32_s
  f32.div
  local.set $8
  loop $for-loop|0
   local.get $5
   local.get $6
   i32.gt_s
   if
    local.get $4
    local.get $6
    i32.mul
    i32.const 2
    i32.shl
    local.set $9
    local.get $6
    f32.convert_i32_s
    local.get $8
    f32.mul
    i32.trunc_sat_f32_s
    local.set $10
    i32.const 0
    local.set $3
    loop $for-loop|1
     local.get $3
     local.get $4
     i32.lt_s
     if
      local.get $1
      local.get $9
      i32.add
      local.get $3
      i32.const 2
      i32.shl
      i32.add
      local.get $0
      local.get $3
      f32.convert_i32_s
      local.get $7
      f32.mul
      i32.trunc_sat_f32_s
      local.get $2
      local.get $10
      i32.mul
      i32.add
      i32.const 2
      i32.shl
      i32.add
      i32.load
      i32.store
      local.get $3
      i32.const 1
      i32.add
      local.set $3
      br $for-loop|1
     end
    end
    local.get $6
    i32.const 1
    i32.add
    local.set $6
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/chromatic (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  loop $for-loop|0
   local.get $5
   local.get $6
   i32.lt_s
   if
    local.get $2
    local.get $5
    i32.mul
    i32.const 2
    i32.shl
    local.set $7
    i32.const 0
    local.set $3
    loop $for-loop|1
     local.get $2
     local.get $3
     i32.gt_s
     if
      local.get $7
      local.get $3
      i32.const 2
      i32.shl
      i32.add
      local.tee $9
      local.get $1
      i32.add
      local.tee $8
      local.get $0
      local.get $7
      local.get $3
      local.get $4
      i32.sub
      f64.convert_i32_s
      f64.const 0
      f64.max
      i32.trunc_sat_f64_u
      i32.const 2
      i32.shl
      i32.add
      i32.add
      i32.load8_u
      i32.store8
      local.get $8
      local.get $0
      local.get $9
      i32.add
      local.tee $9
      i32.load8_u offset=1
      i32.store8 offset=1
      local.get $8
      local.get $0
      local.get $7
      local.get $2
      i32.const 1
      i32.sub
      f64.convert_i32_s
      local.get $3
      local.get $4
      i32.add
      f64.convert_i32_s
      f64.min
      i32.trunc_sat_f64_u
      i32.const 2
      i32.shl
      i32.add
      i32.add
      i32.load8_u
      i32.store8 offset=2
      local.get $8
      local.get $9
      i32.load8_u offset=3
      i32.store8 offset=3
      local.get $3
      i32.const 1
      i32.add
      local.set $3
      br $for-loop|1
     end
    end
    local.get $5
    i32.const 1
    i32.add
    local.set $5
    br $for-loop|0
   end
  end
 )
 (func $~lib/math/pio2_large_quot (param $0 i64) (result i32)
  (local $1 i64)
  (local $2 i64)
  (local $3 i64)
  (local $4 i32)
  (local $5 f64)
  (local $6 i64)
  (local $7 i64)
  (local $8 i64)
  (local $9 i64)
  (local $10 i64)
  (local $11 i64)
  (local $12 i64)
  local.get $0
  i64.const 9223372036854775807
  i64.and
  i64.const 52
  i64.shr_u
  i64.const 1045
  i64.sub
  local.tee $1
  i64.const 63
  i64.and
  local.set $6
  local.get $1
  i64.const 6
  i64.shr_s
  i32.wrap_i64
  i32.const 3
  i32.shl
  i32.const 8256
  i32.add
  local.tee $4
  i64.load
  local.set $3
  local.get $4
  i64.load offset=8
  local.set $2
  local.get $4
  i64.load offset=16
  local.set $1
  local.get $6
  i64.const 0
  i64.ne
  if
   local.get $3
   local.get $6
   i64.shl
   local.get $2
   i64.const 64
   local.get $6
   i64.sub
   local.tee $7
   i64.shr_u
   i64.or
   local.set $3
   local.get $2
   local.get $6
   i64.shl
   local.get $1
   local.get $7
   i64.shr_u
   i64.or
   local.set $2
   local.get $1
   local.get $6
   i64.shl
   local.get $4
   i64.load offset=24
   local.get $7
   i64.shr_u
   i64.or
   local.set $1
  end
  local.get $0
  i64.const 4503599627370495
  i64.and
  i64.const 4503599627370496
  i64.or
  local.tee $6
  i64.const 4294967295
  i64.and
  local.set $7
  local.get $2
  i64.const 4294967295
  i64.and
  local.tee $8
  local.get $6
  i64.const 32
  i64.shr_u
  local.tee $9
  i64.mul
  local.get $2
  i64.const 32
  i64.shr_u
  local.tee $2
  local.get $7
  i64.mul
  local.get $7
  local.get $8
  i64.mul
  local.tee $7
  i64.const 32
  i64.shr_u
  i64.add
  local.tee $8
  i64.const 4294967295
  i64.and
  i64.add
  local.set $10
  local.get $2
  local.get $9
  i64.mul
  local.get $8
  i64.const 32
  i64.shr_u
  i64.add
  local.get $10
  i64.const 32
  i64.shr_u
  i64.add
  global.set $~lib/math/res128_hi
  local.get $9
  local.get $1
  i64.const 32
  i64.shr_u
  i64.mul
  local.tee $1
  local.get $7
  i64.const 4294967295
  i64.and
  local.get $10
  i64.const 32
  i64.shl
  i64.add
  i64.add
  local.tee $2
  local.get $1
  i64.lt_u
  i64.extend_i32_u
  global.get $~lib/math/res128_hi
  local.get $3
  local.get $6
  i64.mul
  i64.add
  i64.add
  local.tee $3
  i64.const 2
  i64.shl
  local.get $2
  i64.const 62
  i64.shr_u
  i64.or
  local.tee $6
  i64.const 63
  i64.shr_s
  local.tee $7
  local.get $2
  i64.const 2
  i64.shl
  i64.xor
  local.set $2
  local.get $6
  local.get $7
  i64.const 1
  i64.shr_s
  i64.xor
  local.tee $1
  i64.clz
  local.set $8
  local.get $1
  local.get $8
  i64.shl
  local.get $2
  i64.const 64
  local.get $8
  i64.sub
  i64.shr_u
  i64.or
  local.tee $9
  i64.const 4294967295
  i64.and
  local.set $1
  local.get $9
  i64.const 32
  i64.shr_u
  local.tee $10
  i64.const 560513588
  i64.mul
  local.get $1
  i64.const 3373259426
  i64.mul
  local.get $1
  i64.const 560513588
  i64.mul
  local.tee $11
  i64.const 32
  i64.shr_u
  i64.add
  local.tee $12
  i64.const 4294967295
  i64.and
  i64.add
  local.set $1
  local.get $10
  i64.const 3373259426
  i64.mul
  local.get $12
  i64.const 32
  i64.shr_u
  i64.add
  local.get $1
  i64.const 32
  i64.shr_u
  i64.add
  global.set $~lib/math/res128_hi
  local.get $9
  f64.convert_i64_u
  f64.const 3.753184150245214e-04
  f64.mul
  local.get $2
  local.get $8
  i64.shl
  f64.convert_i64_u
  f64.const 3.834951969714103e-04
  f64.mul
  f64.add
  i64.trunc_sat_f64_u
  local.tee $2
  local.get $11
  i64.const 4294967295
  i64.and
  local.get $1
  i64.const 32
  i64.shl
  i64.add
  local.tee $1
  i64.gt_u
  i64.extend_i32_u
  global.get $~lib/math/res128_hi
  local.tee $9
  i64.const 11
  i64.shr_u
  i64.add
  f64.convert_i64_u
  global.set $~lib/math/rempio2_y0
  local.get $9
  i64.const 53
  i64.shl
  local.get $1
  i64.const 11
  i64.shr_u
  i64.or
  local.get $2
  i64.add
  f64.convert_i64_u
  f64.const 5.421010862427522e-20
  f64.mul
  global.set $~lib/math/rempio2_y1
  global.get $~lib/math/rempio2_y0
  i64.const 4372995238176751616
  local.get $8
  i64.const 52
  i64.shl
  i64.sub
  local.get $0
  local.get $6
  i64.xor
  i64.const -9223372036854775808
  i64.and
  i64.or
  f64.reinterpret_i64
  local.tee $5
  f64.mul
  global.set $~lib/math/rempio2_y0
  global.get $~lib/math/rempio2_y1
  local.get $5
  f64.mul
  global.set $~lib/math/rempio2_y1
  local.get $3
  i64.const 62
  i64.shr_s
  local.get $7
  i64.sub
  i32.wrap_i64
 )
 (func $~lib/math/NativeMath.sin (param $0 f64) (result f64)
  (local $1 f64)
  (local $2 f64)
  (local $3 i32)
  (local $4 i32)
  (local $5 i64)
  (local $6 i32)
  (local $7 f64)
  (local $8 f64)
  (local $9 f64)
  local.get $0
  i64.reinterpret_f64
  local.tee $5
  i64.const 32
  i64.shr_u
  i32.wrap_i64
  local.tee $3
  i32.const 31
  i32.shr_u
  local.set $6
  local.get $3
  i32.const 2147483647
  i32.and
  local.tee $3
  i32.const 1072243195
  i32.le_u
  if
   local.get $3
   i32.const 1045430272
   i32.lt_u
   if
    local.get $0
    return
   end
   local.get $0
   local.get $0
   local.get $0
   f64.mul
   local.tee $1
   local.get $0
   f64.mul
   local.get $1
   local.get $1
   local.get $1
   f64.const 2.7557313707070068e-06
   f64.mul
   f64.const -1.984126982985795e-04
   f64.add
   f64.mul
   f64.const 0.00833333333332249
   f64.add
   local.get $1
   local.get $1
   local.get $1
   f64.mul
   f64.mul
   local.get $1
   f64.const 1.58969099521155e-10
   f64.mul
   f64.const -2.5050760253406863e-08
   f64.add
   f64.mul
   f64.add
   f64.mul
   f64.const -0.16666666666666632
   f64.add
   f64.mul
   f64.add
   return
  end
  local.get $3
  i32.const 2146435072
  i32.ge_u
  if
   local.get $0
   local.get $0
   f64.sub
   return
  end
  block $~lib/math/rempio2|inlined.0 (result i32)
   local.get $5
   i64.const 32
   i64.shr_u
   i32.wrap_i64
   i32.const 2147483647
   i32.and
   local.tee $4
   i32.const 1073928572
   i32.lt_u
   if
    i32.const 1
    local.set $3
    local.get $6
    if (result f64)
     local.get $0
     f64.const 1.5707963267341256
     f64.add
     local.set $0
     i32.const -1
     local.set $3
     local.get $4
     i32.const 1073291771
     i32.ne
     if (result f64)
      local.get $0
      local.get $0
      f64.const 6.077100506506192e-11
      f64.add
      local.tee $0
      f64.sub
      f64.const 6.077100506506192e-11
      f64.add
     else
      local.get $0
      f64.const 6.077100506303966e-11
      f64.add
      local.tee $1
      f64.const 2.0222662487959506e-21
      f64.add
      local.set $0
      local.get $1
      local.get $0
      f64.sub
      f64.const 2.0222662487959506e-21
      f64.add
     end
    else
     local.get $0
     f64.const -1.5707963267341256
     f64.add
     local.set $0
     local.get $4
     i32.const 1073291771
     i32.ne
     if (result f64)
      local.get $0
      local.get $0
      f64.const -6.077100506506192e-11
      f64.add
      local.tee $0
      f64.sub
      f64.const -6.077100506506192e-11
      f64.add
     else
      local.get $0
      f64.const -6.077100506303966e-11
      f64.add
      local.tee $1
      f64.const -2.0222662487959506e-21
      f64.add
      local.set $0
      local.get $1
      local.get $0
      f64.sub
      f64.const -2.0222662487959506e-21
      f64.add
     end
    end
    local.get $0
    global.set $~lib/math/rempio2_y0
    global.set $~lib/math/rempio2_y1
    local.get $3
    br $~lib/math/rempio2|inlined.0
   end
   local.get $4
   i32.const 1094263291
   i32.lt_u
   if
    local.get $4
    i32.const 20
    i32.shr_u
    local.tee $3
    local.get $0
    local.get $0
    f64.const 0.6366197723675814
    f64.mul
    f64.nearest
    local.tee $7
    f64.const 1.5707963267341256
    f64.mul
    f64.sub
    local.tee $0
    local.get $7
    f64.const 6.077100506506192e-11
    f64.mul
    local.tee $2
    f64.sub
    local.tee $1
    i64.reinterpret_f64
    i64.const 32
    i64.shr_u
    i32.wrap_i64
    i32.const 20
    i32.shr_u
    i32.const 2047
    i32.and
    i32.sub
    i32.const 16
    i32.gt_u
    if
     local.get $7
     f64.const 2.0222662487959506e-21
     f64.mul
     local.get $0
     local.get $0
     local.get $7
     f64.const 6.077100506303966e-11
     f64.mul
     local.tee $1
     f64.sub
     local.tee $0
     f64.sub
     local.get $1
     f64.sub
     f64.sub
     local.set $2
     local.get $3
     local.get $0
     local.get $2
     f64.sub
     local.tee $1
     i64.reinterpret_f64
     i64.const 32
     i64.shr_u
     i32.wrap_i64
     i32.const 20
     i32.shr_u
     i32.const 2047
     i32.and
     i32.sub
     i32.const 49
     i32.gt_u
     if
      local.get $7
      f64.const 8.4784276603689e-32
      f64.mul
      local.get $0
      local.get $0
      local.get $7
      f64.const 2.0222662487111665e-21
      f64.mul
      local.tee $1
      f64.sub
      local.tee $0
      f64.sub
      local.get $1
      f64.sub
      f64.sub
      local.set $2
      local.get $0
      local.get $2
      f64.sub
      local.set $1
     end
    end
    local.get $1
    global.set $~lib/math/rempio2_y0
    local.get $0
    local.get $1
    f64.sub
    local.get $2
    f64.sub
    global.set $~lib/math/rempio2_y1
    local.get $7
    i32.trunc_sat_f64_s
    br $~lib/math/rempio2|inlined.0
   end
   i32.const 0
   local.get $5
   call $~lib/math/pio2_large_quot
   local.tee $3
   i32.sub
   local.get $3
   local.get $6
   select
  end
  local.set $3
  global.get $~lib/math/rempio2_y0
  local.set $2
  global.get $~lib/math/rempio2_y1
  local.set $7
  local.get $3
  i32.const 1
  i32.and
  if (result f64)
   local.get $2
   local.get $2
   f64.mul
   local.tee $0
   local.get $0
   f64.mul
   local.set $1
   f64.const 1
   local.get $0
   f64.const 0.5
   f64.mul
   local.tee $8
   f64.sub
   local.tee $9
   f64.const 1
   local.get $9
   f64.sub
   local.get $8
   f64.sub
   local.get $0
   local.get $0
   local.get $0
   local.get $0
   f64.const 2.480158728947673e-05
   f64.mul
   f64.const -0.001388888888887411
   f64.add
   f64.mul
   f64.const 0.0416666666666666
   f64.add
   f64.mul
   local.get $1
   local.get $1
   f64.mul
   local.get $0
   local.get $0
   f64.const -1.1359647557788195e-11
   f64.mul
   f64.const 2.087572321298175e-09
   f64.add
   f64.mul
   f64.const -2.7557314351390663e-07
   f64.add
   f64.mul
   f64.add
   f64.mul
   local.get $2
   local.get $7
   f64.mul
   f64.sub
   f64.add
   f64.add
  else
   local.get $2
   local.get $2
   f64.mul
   local.tee $0
   local.get $2
   f64.mul
   local.set $1
   local.get $2
   local.get $0
   local.get $7
   f64.const 0.5
   f64.mul
   local.get $1
   local.get $0
   local.get $0
   f64.const 2.7557313707070068e-06
   f64.mul
   f64.const -1.984126982985795e-04
   f64.add
   f64.mul
   f64.const 0.00833333333332249
   f64.add
   local.get $0
   local.get $0
   local.get $0
   f64.mul
   f64.mul
   local.get $0
   f64.const 1.58969099521155e-10
   f64.mul
   f64.const -2.5050760253406863e-08
   f64.add
   f64.mul
   f64.add
   f64.mul
   f64.sub
   f64.mul
   local.get $7
   f64.sub
   local.get $1
   f64.const -0.16666666666666632
   f64.mul
   f64.sub
   f64.sub
  end
  local.tee $0
  f64.neg
  local.get $0
  local.get $3
  i32.const 2
  i32.and
  select
 )
 (func $~lib/math/NativeMath.cos (param $0 f64) (result f64)
  (local $1 f64)
  (local $2 f64)
  (local $3 i32)
  (local $4 i32)
  (local $5 i64)
  (local $6 i32)
  (local $7 f64)
  (local $8 f64)
  (local $9 f64)
  local.get $0
  i64.reinterpret_f64
  local.tee $5
  i64.const 32
  i64.shr_u
  i32.wrap_i64
  local.tee $3
  i32.const 31
  i32.shr_u
  local.set $6
  local.get $3
  i32.const 2147483647
  i32.and
  local.tee $3
  i32.const 1072243195
  i32.le_u
  if
   local.get $3
   i32.const 1044816030
   i32.lt_u
   if
    f64.const 1
    return
   end
   local.get $0
   local.get $0
   f64.mul
   local.tee $1
   local.get $1
   f64.mul
   local.set $2
   f64.const 1
   local.get $1
   f64.const 0.5
   f64.mul
   local.tee $7
   f64.sub
   local.tee $8
   f64.const 1
   local.get $8
   f64.sub
   local.get $7
   f64.sub
   local.get $1
   local.get $1
   local.get $1
   local.get $1
   f64.const 2.480158728947673e-05
   f64.mul
   f64.const -0.001388888888887411
   f64.add
   f64.mul
   f64.const 0.0416666666666666
   f64.add
   f64.mul
   local.get $2
   local.get $2
   f64.mul
   local.get $1
   local.get $1
   f64.const -1.1359647557788195e-11
   f64.mul
   f64.const 2.087572321298175e-09
   f64.add
   f64.mul
   f64.const -2.7557314351390663e-07
   f64.add
   f64.mul
   f64.add
   f64.mul
   local.get $0
   f64.const 0
   f64.mul
   f64.sub
   f64.add
   f64.add
   return
  end
  local.get $3
  i32.const 2146435072
  i32.ge_u
  if
   local.get $0
   local.get $0
   f64.sub
   return
  end
  block $~lib/math/rempio2|inlined.1 (result i32)
   local.get $5
   i64.const 32
   i64.shr_u
   i32.wrap_i64
   i32.const 2147483647
   i32.and
   local.tee $4
   i32.const 1073928572
   i32.lt_u
   if
    i32.const 1
    local.set $3
    local.get $6
    if (result f64)
     local.get $0
     f64.const 1.5707963267341256
     f64.add
     local.set $0
     i32.const -1
     local.set $3
     local.get $4
     i32.const 1073291771
     i32.ne
     if (result f64)
      local.get $0
      local.get $0
      f64.const 6.077100506506192e-11
      f64.add
      local.tee $0
      f64.sub
      f64.const 6.077100506506192e-11
      f64.add
     else
      local.get $0
      f64.const 6.077100506303966e-11
      f64.add
      local.tee $1
      f64.const 2.0222662487959506e-21
      f64.add
      local.set $0
      local.get $1
      local.get $0
      f64.sub
      f64.const 2.0222662487959506e-21
      f64.add
     end
    else
     local.get $0
     f64.const -1.5707963267341256
     f64.add
     local.set $0
     local.get $4
     i32.const 1073291771
     i32.ne
     if (result f64)
      local.get $0
      local.get $0
      f64.const -6.077100506506192e-11
      f64.add
      local.tee $0
      f64.sub
      f64.const -6.077100506506192e-11
      f64.add
     else
      local.get $0
      f64.const -6.077100506303966e-11
      f64.add
      local.tee $1
      f64.const -2.0222662487959506e-21
      f64.add
      local.set $0
      local.get $1
      local.get $0
      f64.sub
      f64.const -2.0222662487959506e-21
      f64.add
     end
    end
    local.get $0
    global.set $~lib/math/rempio2_y0
    global.set $~lib/math/rempio2_y1
    local.get $3
    br $~lib/math/rempio2|inlined.1
   end
   local.get $4
   i32.const 1094263291
   i32.lt_u
   if
    local.get $4
    i32.const 20
    i32.shr_u
    local.tee $3
    local.get $0
    local.get $0
    f64.const 0.6366197723675814
    f64.mul
    f64.nearest
    local.tee $7
    f64.const 1.5707963267341256
    f64.mul
    f64.sub
    local.tee $0
    local.get $7
    f64.const 6.077100506506192e-11
    f64.mul
    local.tee $2
    f64.sub
    local.tee $1
    i64.reinterpret_f64
    i64.const 32
    i64.shr_u
    i32.wrap_i64
    i32.const 20
    i32.shr_u
    i32.const 2047
    i32.and
    i32.sub
    i32.const 16
    i32.gt_u
    if
     local.get $7
     f64.const 2.0222662487959506e-21
     f64.mul
     local.get $0
     local.get $0
     local.get $7
     f64.const 6.077100506303966e-11
     f64.mul
     local.tee $1
     f64.sub
     local.tee $0
     f64.sub
     local.get $1
     f64.sub
     f64.sub
     local.set $2
     local.get $3
     local.get $0
     local.get $2
     f64.sub
     local.tee $1
     i64.reinterpret_f64
     i64.const 32
     i64.shr_u
     i32.wrap_i64
     i32.const 20
     i32.shr_u
     i32.const 2047
     i32.and
     i32.sub
     i32.const 49
     i32.gt_u
     if
      local.get $7
      f64.const 8.4784276603689e-32
      f64.mul
      local.get $0
      local.get $0
      local.get $7
      f64.const 2.0222662487111665e-21
      f64.mul
      local.tee $1
      f64.sub
      local.tee $0
      f64.sub
      local.get $1
      f64.sub
      f64.sub
      local.set $2
      local.get $0
      local.get $2
      f64.sub
      local.set $1
     end
    end
    local.get $1
    global.set $~lib/math/rempio2_y0
    local.get $0
    local.get $1
    f64.sub
    local.get $2
    f64.sub
    global.set $~lib/math/rempio2_y1
    local.get $7
    i32.trunc_sat_f64_s
    br $~lib/math/rempio2|inlined.1
   end
   i32.const 0
   local.get $5
   call $~lib/math/pio2_large_quot
   local.tee $3
   i32.sub
   local.get $3
   local.get $6
   select
  end
  local.set $3
  global.get $~lib/math/rempio2_y0
  local.set $1
  global.get $~lib/math/rempio2_y1
  local.set $2
  local.get $3
  i32.const 1
  i32.and
  if (result f64)
   local.get $1
   local.get $1
   f64.mul
   local.tee $0
   local.get $1
   f64.mul
   local.set $7
   local.get $1
   local.get $0
   local.get $2
   f64.const 0.5
   f64.mul
   local.get $7
   local.get $0
   local.get $0
   f64.const 2.7557313707070068e-06
   f64.mul
   f64.const -1.984126982985795e-04
   f64.add
   f64.mul
   f64.const 0.00833333333332249
   f64.add
   local.get $0
   local.get $0
   local.get $0
   f64.mul
   f64.mul
   local.get $0
   f64.const 1.58969099521155e-10
   f64.mul
   f64.const -2.5050760253406863e-08
   f64.add
   f64.mul
   f64.add
   f64.mul
   f64.sub
   f64.mul
   local.get $2
   f64.sub
   local.get $7
   f64.const -0.16666666666666632
   f64.mul
   f64.sub
   f64.sub
  else
   local.get $1
   local.get $1
   f64.mul
   local.tee $7
   local.get $7
   f64.mul
   local.set $8
   f64.const 1
   local.get $7
   f64.const 0.5
   f64.mul
   local.tee $0
   f64.sub
   local.tee $9
   f64.const 1
   local.get $9
   f64.sub
   local.get $0
   f64.sub
   local.get $7
   local.get $7
   local.get $7
   local.get $7
   f64.const 2.480158728947673e-05
   f64.mul
   f64.const -0.001388888888887411
   f64.add
   f64.mul
   f64.const 0.0416666666666666
   f64.add
   f64.mul
   local.get $8
   local.get $8
   f64.mul
   local.get $7
   local.get $7
   f64.const -1.1359647557788195e-11
   f64.mul
   f64.const 2.087572321298175e-09
   f64.add
   f64.mul
   f64.const -2.7557314351390663e-07
   f64.add
   f64.mul
   f64.add
   f64.mul
   local.get $1
   local.get $2
   f64.mul
   f64.sub
   f64.add
   f64.add
  end
  local.tee $0
  f64.neg
  local.get $0
  local.get $3
  i32.const 1
  i32.add
  i32.const 2
  i32.and
  select
 )
 (func $assembly/filters/wave (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 f32) (param $5 f32) (param $6 i32) (param $7 i32)
  (local $8 i32)
  (local $9 i32)
  (local $10 f64)
  (local $11 f32)
  (local $12 f32)
  (local $13 i32)
  (local $14 i32)
  (local $15 i32)
  (local $16 i32)
  (local $17 i32)
  (local $18 f32)
  (local $19 i32)
  (local $20 f32)
  (local $21 f32)
  (local $22 f32)
  (local $23 f32)
  f64.const 6.283185307179586
  local.get $5
  f64.promote_f32
  f64.div
  f32.demote_f64
  local.set $5
  loop $for-loop|0
   local.get $6
   local.get $7
   i32.lt_s
   if
    local.get $2
    local.get $6
    i32.mul
    i32.const 2
    i32.shl
    local.set $9
    i32.const 0
    local.set $8
    loop $for-loop|1
     local.get $2
     local.get $8
     i32.gt_s
     if
      local.get $1
      local.get $9
      i32.add
      local.get $8
      i32.const 2
      i32.shl
      i32.add
      block $assembly/math/sampleBilinear|inlined.0 (result i32)
       local.get $8
       f32.convert_i32_s
       local.get $4
       local.get $6
       f64.convert_i32_s
       local.get $5
       f64.promote_f32
       local.tee $10
       f64.mul
       call $~lib/math/NativeMath.sin
       f32.demote_f64
       f32.mul
       f32.add
       local.set $11
       i32.const 0
       local.get $6
       f32.convert_i32_s
       local.get $4
       local.get $8
       f64.convert_i32_s
       local.get $10
       f64.mul
       call $~lib/math/NativeMath.cos
       f32.demote_f64
       f32.mul
       f32.add
       local.tee $12
       local.get $12
       f32.ne
       local.get $11
       local.get $11
       f32.ne
       i32.or
       br_if $assembly/math/sampleBilinear|inlined.0
       drop
       local.get $2
       f64.convert_i32_s
       f64.const -1.000001
       f64.add
       f32.demote_f64
       f32.const 0
       local.get $11
       local.get $11
       f32.const 0
       f32.lt
       select
       local.tee $11
       local.get $11
       local.get $2
       f32.convert_i32_s
       f32.const -1
       f32.add
       f32.ge
       select
       local.tee $11
       f64.promote_f32
       f64.floor
       i32.trunc_sat_f64_s
       local.tee $13
       i32.const 1
       i32.add
       local.set $14
       local.get $3
       f64.convert_i32_s
       f64.const -1.000001
       f64.add
       f32.demote_f64
       f32.const 0
       local.get $12
       local.get $12
       f32.const 0
       f32.lt
       select
       local.tee $12
       local.get $12
       local.get $3
       f32.convert_i32_s
       f32.const -1
       f32.add
       f32.ge
       select
       local.tee $12
       f64.promote_f32
       f64.floor
       i32.trunc_sat_f64_s
       local.tee $15
       local.get $2
       i32.mul
       local.tee $16
       local.get $13
       i32.add
       i32.const 2
       i32.shl
       local.get $0
       i32.add
       local.tee $17
       i32.load8_u offset=1
       f32.convert_i32_u
       local.tee $18
       local.get $14
       local.get $16
       i32.add
       i32.const 2
       i32.shl
       local.get $0
       i32.add
       local.tee $16
       i32.load8_u offset=1
       f32.convert_i32_u
       local.get $18
       f32.sub
       local.get $11
       local.get $13
       f32.convert_i32_s
       f32.sub
       local.tee $18
       f32.mul
       f32.add
       local.tee $11
       local.get $2
       local.get $15
       i32.const 1
       i32.add
       i32.mul
       local.tee $19
       local.get $13
       i32.add
       i32.const 2
       i32.shl
       local.get $0
       i32.add
       local.tee $13
       i32.load8_u offset=1
       f32.convert_i32_u
       local.tee $20
       local.get $14
       local.get $19
       i32.add
       i32.const 2
       i32.shl
       local.get $0
       i32.add
       local.tee $14
       i32.load8_u offset=1
       f32.convert_i32_u
       local.get $20
       f32.sub
       local.get $18
       f32.mul
       f32.add
       local.get $11
       f32.sub
       local.get $12
       local.get $15
       f32.convert_i32_s
       f32.sub
       local.tee $12
       f32.mul
       f32.add
       local.set $20
       local.get $17
       i32.load8_u offset=2
       f32.convert_i32_u
       local.tee $11
       local.get $16
       i32.load8_u offset=2
       f32.convert_i32_u
       local.get $11
       f32.sub
       local.get $18
       f32.mul
       f32.add
       local.tee $11
       local.get $13
       i32.load8_u offset=2
       f32.convert_i32_u
       local.tee $21
       local.get $14
       i32.load8_u offset=2
       f32.convert_i32_u
       local.get $21
       f32.sub
       local.get $18
       f32.mul
       f32.add
       local.get $11
       f32.sub
       local.get $12
       f32.mul
       f32.add
       local.set $21
       local.get $17
       i32.load8_u offset=3
       f32.convert_i32_u
       local.tee $11
       local.get $16
       i32.load8_u offset=3
       f32.convert_i32_u
       local.get $11
       f32.sub
       local.get $18
       f32.mul
       f32.add
       local.tee $11
       local.get $13
       i32.load8_u offset=3
       f32.convert_i32_u
       local.tee $22
       local.get $14
       i32.load8_u offset=3
       f32.convert_i32_u
       local.get $22
       f32.sub
       local.get $18
       f32.mul
       f32.add
       local.get $11
       f32.sub
       local.get $12
       f32.mul
       f32.add
       local.set $22
       block $assembly/math/clamp255|inlined.9 (result i32)
        i32.const 0
        local.get $17
        i32.load8_u
        f32.convert_i32_u
        local.tee $11
        local.get $16
        i32.load8_u
        f32.convert_i32_u
        local.get $11
        f32.sub
        local.get $18
        f32.mul
        f32.add
        local.tee $11
        local.get $13
        i32.load8_u
        f32.convert_i32_u
        local.tee $23
        local.get $14
        i32.load8_u
        f32.convert_i32_u
        local.get $23
        f32.sub
        local.get $18
        f32.mul
        f32.add
        local.get $11
        f32.sub
        local.get $12
        f32.mul
        f32.add
        local.tee $11
        local.get $11
        f32.ne
        br_if $assembly/math/clamp255|inlined.9
        drop
        i32.const 0
        local.get $11
        f32.const 0
        f32.lt
        br_if $assembly/math/clamp255|inlined.9
        drop
        i32.const 255
        local.get $11
        f32.const 255
        f32.gt
        br_if $assembly/math/clamp255|inlined.9
        drop
        local.get $11
        i32.trunc_sat_f32_u
       end
       i32.const 255
       i32.and
       block $assembly/math/clamp255|inlined.10 (result i32)
        i32.const 0
        local.get $20
        local.get $20
        f32.ne
        br_if $assembly/math/clamp255|inlined.10
        drop
        i32.const 0
        local.get $20
        f32.const 0
        f32.lt
        br_if $assembly/math/clamp255|inlined.10
        drop
        i32.const 255
        local.get $20
        f32.const 255
        f32.gt
        br_if $assembly/math/clamp255|inlined.10
        drop
        local.get $20
        i32.trunc_sat_f32_u
       end
       i32.const 255
       i32.and
       i32.const 8
       i32.shl
       i32.or
       block $assembly/math/clamp255|inlined.11 (result i32)
        i32.const 0
        local.get $21
        local.get $21
        f32.ne
        br_if $assembly/math/clamp255|inlined.11
        drop
        i32.const 0
        local.get $21
        f32.const 0
        f32.lt
        br_if $assembly/math/clamp255|inlined.11
        drop
        i32.const 255
        local.get $21
        f32.const 255
        f32.gt
        br_if $assembly/math/clamp255|inlined.11
        drop
        local.get $21
        i32.trunc_sat_f32_u
       end
       i32.const 255
       i32.and
       i32.const 16
       i32.shl
       i32.or
       block $assembly/math/clamp255|inlined.12 (result i32)
        i32.const 0
        local.get $22
        local.get $22
        f32.ne
        br_if $assembly/math/clamp255|inlined.12
        drop
        i32.const 0
        local.get $22
        f32.const 0
        f32.lt
        br_if $assembly/math/clamp255|inlined.12
        drop
        i32.const 255
        local.get $22
        f32.const 255
        f32.gt
        br_if $assembly/math/clamp255|inlined.12
        drop
        local.get $22
        i32.trunc_sat_f32_u
       end
       i32.const 255
       i32.and
       i32.const 24
       i32.shl
       i32.or
      end
      i32.store
      local.get $8
      i32.const 1
      i32.add
      local.set $8
      br $for-loop|1
     end
    end
    local.get $6
    i32.const 1
    i32.add
    local.set $6
    br $for-loop|0
   end
  end
 )
 (func $~lib/math/NativeMath.atan (param $0 f64) (result f64)
  (local $1 f64)
  (local $2 i32)
  (local $3 i32)
  (local $4 f64)
  (local $5 f64)
  local.get $0
  local.set $1
  local.get $0
  i64.reinterpret_f64
  i64.const 32
  i64.shr_u
  i32.wrap_i64
  i32.const 2147483647
  i32.and
  local.tee $2
  i32.const 1141899264
  i32.ge_u
  if
   local.get $0
   local.get $0
   f64.ne
   if
    local.get $0
    return
   end
   f64.const 1.5707963267948966
   local.get $1
   f64.copysign
   return
  end
  local.get $2
  i32.const 1071382528
  i32.lt_u
  if
   local.get $2
   i32.const 1044381696
   i32.lt_u
   if
    local.get $0
    return
   end
   i32.const -1
   local.set $3
  else
   local.get $0
   f64.abs
   local.set $0
   local.get $2
   i32.const 1072889856
   i32.lt_u
   if (result f64)
    local.get $2
    i32.const 1072037888
    i32.lt_u
    if (result f64)
     local.get $0
     local.get $0
     f64.add
     f64.const -1
     f64.add
     local.get $0
     f64.const 2
     f64.add
     f64.div
    else
     i32.const 1
     local.set $3
     local.get $0
     f64.const -1
     f64.add
     local.get $0
     f64.const 1
     f64.add
     f64.div
    end
   else
    local.get $2
    i32.const 1073971200
    i32.lt_u
    if (result f64)
     i32.const 2
     local.set $3
     local.get $0
     f64.const -1.5
     f64.add
     local.get $0
     f64.const 1.5
     f64.mul
     f64.const 1
     f64.add
     f64.div
    else
     i32.const 3
     local.set $3
     f64.const -1
     local.get $0
     f64.div
    end
   end
   local.set $0
  end
  local.get $0
  local.get $0
  f64.mul
  local.tee $5
  local.get $5
  f64.mul
  local.set $4
  local.get $0
  local.get $5
  local.get $4
  local.get $4
  local.get $4
  local.get $4
  local.get $4
  f64.const 0.016285820115365782
  f64.mul
  f64.const 0.049768779946159324
  f64.add
  f64.mul
  f64.const 0.06661073137387531
  f64.add
  f64.mul
  f64.const 0.09090887133436507
  f64.add
  f64.mul
  f64.const 0.14285714272503466
  f64.add
  f64.mul
  f64.const 0.3333333333333293
  f64.add
  f64.mul
  local.get $4
  local.get $4
  local.get $4
  local.get $4
  local.get $4
  f64.const -0.036531572744216916
  f64.mul
  f64.const -0.058335701337905735
  f64.add
  f64.mul
  f64.const -0.0769187620504483
  f64.add
  f64.mul
  f64.const -0.11111110405462356
  f64.add
  f64.mul
  f64.const -0.19999999999876483
  f64.add
  f64.mul
  f64.add
  f64.mul
  local.set $4
  local.get $3
  i32.const 0
  i32.lt_s
  if
   local.get $0
   local.get $4
   f64.sub
   return
  end
  block $break|0
   block $case4|0
    block $case3|0
     block $case2|0
      block $case1|0
       block $case0|0
        local.get $3
        br_table $case0|0 $case1|0 $case2|0 $case3|0 $case4|0
       end
       f64.const 0.4636476090008061
       local.get $4
       f64.const -2.2698777452961687e-17
       f64.add
       local.get $0
       f64.sub
       f64.sub
       local.set $0
       br $break|0
      end
      f64.const 0.7853981633974483
      local.get $4
      f64.const -3.061616997868383e-17
      f64.add
      local.get $0
      f64.sub
      f64.sub
      local.set $0
      br $break|0
     end
     f64.const 0.982793723247329
     local.get $4
     f64.const -1.3903311031230998e-17
     f64.add
     local.get $0
     f64.sub
     f64.sub
     local.set $0
     br $break|0
    end
    f64.const 1.5707963267948966
    local.get $4
    f64.const -6.123233995736766e-17
    f64.add
    local.get $0
    f64.sub
    f64.sub
    local.set $0
    br $break|0
   end
   unreachable
  end
  local.get $0
  local.get $1
  f64.copysign
 )
 (func $assembly/filters/twist (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 f32) (param $5 i32) (param $6 i32)
  (local $7 f64)
  (local $8 i32)
  (local $9 f32)
  (local $10 f32)
  (local $11 f32)
  (local $12 f32)
  (local $13 i64)
  (local $14 f32)
  (local $15 f32)
  (local $16 i32)
  (local $17 i64)
  (local $18 f64)
  (local $19 i32)
  (local $20 i32)
  (local $21 i32)
  (local $22 i32)
  (local $23 f32)
  (local $24 i32)
  (local $25 f32)
  (local $26 f32)
  (local $27 f32)
  (local $28 f32)
  local.get $2
  f32.convert_i32_s
  f32.const 0.5
  f32.mul
  local.tee $10
  local.get $10
  f32.mul
  local.get $3
  f32.convert_i32_s
  f32.const 0.5
  f32.mul
  local.tee $11
  local.get $11
  f32.mul
  f32.add
  f64.promote_f32
  f64.sqrt
  f32.demote_f64
  local.set $15
  loop $for-loop|0
   local.get $5
   local.get $6
   i32.lt_s
   if
    local.get $2
    local.get $5
    i32.mul
    i32.const 2
    i32.shl
    local.set $16
    local.get $5
    f32.convert_i32_s
    local.get $11
    f32.sub
    local.set $12
    i32.const 0
    local.set $8
    loop $for-loop|1
     local.get $2
     local.get $8
     i32.gt_s
     if
      local.get $1
      local.get $16
      i32.add
      local.get $8
      i32.const 2
      i32.shl
      i32.add
      block $assembly/math/sampleBilinear|inlined.1 (result i32)
       local.get $10
       local.get $8
       f32.convert_i32_s
       local.get $10
       f32.sub
       local.tee $9
       local.get $9
       f32.mul
       local.get $12
       local.get $12
       f32.mul
       f32.add
       f64.promote_f32
       f64.sqrt
       f32.demote_f64
       local.tee $14
       block $__inlined_func$~lib/math/NativeMath.atan2 (result f64)
        local.get $12
        f64.promote_f32
        local.tee $18
        local.get $18
        f64.ne
        local.get $9
        f64.promote_f32
        local.tee $7
        local.get $7
        f64.ne
        i32.or
        if
         local.get $7
         local.get $18
         f64.add
         br $__inlined_func$~lib/math/NativeMath.atan2
        end
        local.get $18
        i64.reinterpret_f64
        local.tee $13
        i64.const 32
        i64.shr_u
        i32.wrap_i64
        local.set $19
        local.get $7
        i64.reinterpret_f64
        local.tee $17
        i64.const 32
        i64.shr_u
        i32.wrap_i64
        local.set $20
        local.get $17
        i32.wrap_i64
        local.tee $21
        local.get $20
        i32.const 1072693248
        i32.sub
        i32.or
        i32.eqz
        if
         local.get $18
         call $~lib/math/NativeMath.atan
         br $__inlined_func$~lib/math/NativeMath.atan2
        end
        local.get $20
        i32.const 30
        i32.shr_u
        i32.const 2
        i32.and
        local.get $19
        i32.const 31
        i32.shr_u
        i32.or
        local.set $22
        local.get $19
        i32.const 2147483647
        i32.and
        local.tee $19
        local.get $13
        i32.wrap_i64
        i32.or
        i32.eqz
        if
         block $break|0
          block $case3|0
           block $case2|0
            block $case0|0
             local.get $22
             br_table $case0|0 $case0|0 $case2|0 $case3|0 $break|0
            end
            local.get $18
            br $__inlined_func$~lib/math/NativeMath.atan2
           end
           f64.const 3.141592653589793
           br $__inlined_func$~lib/math/NativeMath.atan2
          end
          f64.const -3.141592653589793
          br $__inlined_func$~lib/math/NativeMath.atan2
         end
        end
        block $folding-inner0
         local.get $20
         i32.const 2147483647
         i32.and
         local.tee $20
         local.get $21
         i32.or
         i32.eqz
         br_if $folding-inner0
         local.get $20
         i32.const 2146435072
         i32.eq
         if
          local.get $19
          i32.const 2146435072
          i32.eq
          if (result f64)
           f64.const 2.356194490192345
           f64.const 0.7853981633974483
           local.get $22
           i32.const 2
           i32.and
           select
           local.tee $7
           f64.neg
           local.get $7
           local.get $22
           i32.const 1
           i32.and
           select
          else
           f64.const 3.141592653589793
           f64.const 0
           local.get $22
           i32.const 2
           i32.and
           select
           local.tee $7
           f64.neg
           local.get $7
           local.get $22
           i32.const 1
           i32.and
           select
          end
          br $__inlined_func$~lib/math/NativeMath.atan2
         end
         local.get $19
         i32.const 2146435072
         i32.eq
         local.get $20
         i32.const 67108864
         i32.add
         local.get $19
         i32.lt_u
         i32.or
         br_if $folding-inner0
         local.get $19
         i32.const 67108864
         i32.add
         local.get $20
         i32.lt_u
         i32.const 0
         local.get $22
         i32.const 2
         i32.and
         select
         if (result f64)
          f64.const 0
         else
          local.get $18
          local.get $7
          f64.div
          f64.abs
          call $~lib/math/NativeMath.atan
         end
         local.set $7
         block $break|1
          block $case3|1
           block $case2|1
            block $case1|1
             block $case0|1
              local.get $22
              br_table $case0|1 $case1|1 $case2|1 $case3|1 $break|1
             end
             local.get $7
             br $__inlined_func$~lib/math/NativeMath.atan2
            end
            local.get $7
            f64.neg
            br $__inlined_func$~lib/math/NativeMath.atan2
           end
           f64.const 3.141592653589793
           local.get $7
           f64.const -1.2246467991473532e-16
           f64.add
           f64.sub
           br $__inlined_func$~lib/math/NativeMath.atan2
          end
          local.get $7
          f64.const -1.2246467991473532e-16
          f64.add
          f64.const -3.141592653589793
          f64.add
          br $__inlined_func$~lib/math/NativeMath.atan2
         end
         unreachable
        end
        f64.const -1.5707963267948966
        f64.const 1.5707963267948966
        local.get $22
        i32.const 1
        i32.and
        select
       end
       f32.demote_f64
       local.get $4
       f32.const 1
       local.get $14
       local.get $15
       f32.div
       f32.sub
       f32.mul
       f32.add
       f64.promote_f32
       local.tee $7
       call $~lib/math/NativeMath.cos
       f32.demote_f64
       f32.mul
       f32.add
       local.set $9
       i32.const 0
       local.get $11
       local.get $14
       local.get $7
       call $~lib/math/NativeMath.sin
       f32.demote_f64
       f32.mul
       f32.add
       local.tee $14
       local.get $14
       f32.ne
       local.get $9
       local.get $9
       f32.ne
       i32.or
       br_if $assembly/math/sampleBilinear|inlined.1
       drop
       local.get $2
       f64.convert_i32_s
       f64.const -1.000001
       f64.add
       f32.demote_f64
       f32.const 0
       local.get $9
       local.get $9
       f32.const 0
       f32.lt
       select
       local.tee $9
       local.get $9
       local.get $2
       f32.convert_i32_s
       f32.const -1
       f32.add
       f32.ge
       select
       local.tee $23
       f64.promote_f32
       f64.floor
       i32.trunc_sat_f64_s
       local.tee $19
       i32.const 1
       i32.add
       local.set $20
       local.get $3
       f64.convert_i32_s
       f64.const -1.000001
       f64.add
       f32.demote_f64
       f32.const 0
       local.get $14
       local.get $14
       f32.const 0
       f32.lt
       select
       local.tee $9
       local.get $9
       local.get $3
       f32.convert_i32_s
       f32.const -1
       f32.add
       f32.ge
       select
       local.tee $9
       local.get $9
       f64.promote_f32
       f64.floor
       i32.trunc_sat_f64_s
       local.tee $21
       f32.convert_i32_s
       f32.sub
       local.set $9
       local.get $2
       local.get $21
       i32.mul
       local.tee $22
       local.get $19
       i32.add
       i32.const 2
       i32.shl
       local.get $0
       i32.add
       local.tee $24
       i32.load8_u
       f32.convert_i32_u
       local.tee $14
       local.get $20
       local.get $22
       i32.add
       i32.const 2
       i32.shl
       local.get $0
       i32.add
       local.tee $22
       i32.load8_u
       f32.convert_i32_u
       local.get $14
       f32.sub
       local.get $23
       local.get $19
       f32.convert_i32_s
       f32.sub
       local.tee $23
       f32.mul
       f32.add
       local.set $14
       local.get $24
       i32.load8_u offset=1
       f32.convert_i32_u
       local.tee $25
       local.get $22
       i32.load8_u offset=1
       f32.convert_i32_u
       local.get $25
       f32.sub
       local.get $23
       f32.mul
       f32.add
       local.tee $25
       local.get $21
       i32.const 1
       i32.add
       local.get $2
       i32.mul
       local.tee $21
       local.get $19
       i32.add
       i32.const 2
       i32.shl
       local.get $0
       i32.add
       local.tee $19
       i32.load8_u offset=1
       f32.convert_i32_u
       local.tee $26
       local.get $20
       local.get $21
       i32.add
       i32.const 2
       i32.shl
       local.get $0
       i32.add
       local.tee $20
       i32.load8_u offset=1
       f32.convert_i32_u
       local.get $26
       f32.sub
       local.get $23
       f32.mul
       f32.add
       local.get $25
       f32.sub
       local.get $9
       f32.mul
       f32.add
       local.set $25
       local.get $24
       i32.load8_u offset=2
       f32.convert_i32_u
       local.tee $26
       local.get $22
       i32.load8_u offset=2
       f32.convert_i32_u
       local.get $26
       f32.sub
       local.get $23
       f32.mul
       f32.add
       local.tee $26
       local.get $19
       i32.load8_u offset=2
       f32.convert_i32_u
       local.tee $27
       local.get $20
       i32.load8_u offset=2
       f32.convert_i32_u
       local.get $27
       f32.sub
       local.get $23
       f32.mul
       f32.add
       local.get $26
       f32.sub
       local.get $9
       f32.mul
       f32.add
       local.set $26
       local.get $24
       i32.load8_u offset=3
       f32.convert_i32_u
       local.tee $27
       local.get $22
       i32.load8_u offset=3
       f32.convert_i32_u
       local.get $27
       f32.sub
       local.get $23
       f32.mul
       f32.add
       local.tee $27
       local.get $19
       i32.load8_u offset=3
       f32.convert_i32_u
       local.tee $28
       local.get $20
       i32.load8_u offset=3
       f32.convert_i32_u
       local.get $28
       f32.sub
       local.get $23
       f32.mul
       f32.add
       local.get $27
       f32.sub
       local.get $9
       f32.mul
       f32.add
       local.set $27
       block $assembly/math/clamp255|inlined.13 (result i32)
        i32.const 0
        local.get $14
        local.get $19
        i32.load8_u
        f32.convert_i32_u
        local.tee $28
        local.get $20
        i32.load8_u
        f32.convert_i32_u
        local.get $28
        f32.sub
        local.get $23
        f32.mul
        f32.add
        local.get $14
        f32.sub
        local.get $9
        f32.mul
        f32.add
        local.tee $9
        local.get $9
        f32.ne
        br_if $assembly/math/clamp255|inlined.13
        drop
        i32.const 0
        local.get $9
        f32.const 0
        f32.lt
        br_if $assembly/math/clamp255|inlined.13
        drop
        i32.const 255
        local.get $9
        f32.const 255
        f32.gt
        br_if $assembly/math/clamp255|inlined.13
        drop
        local.get $9
        i32.trunc_sat_f32_u
       end
       i32.const 255
       i32.and
       block $assembly/math/clamp255|inlined.14 (result i32)
        i32.const 0
        local.get $25
        local.get $25
        f32.ne
        br_if $assembly/math/clamp255|inlined.14
        drop
        i32.const 0
        local.get $25
        f32.const 0
        f32.lt
        br_if $assembly/math/clamp255|inlined.14
        drop
        i32.const 255
        local.get $25
        f32.const 255
        f32.gt
        br_if $assembly/math/clamp255|inlined.14
        drop
        local.get $25
        i32.trunc_sat_f32_u
       end
       i32.const 255
       i32.and
       i32.const 8
       i32.shl
       i32.or
       block $assembly/math/clamp255|inlined.15 (result i32)
        i32.const 0
        local.get $26
        local.get $26
        f32.ne
        br_if $assembly/math/clamp255|inlined.15
        drop
        i32.const 0
        local.get $26
        f32.const 0
        f32.lt
        br_if $assembly/math/clamp255|inlined.15
        drop
        i32.const 255
        local.get $26
        f32.const 255
        f32.gt
        br_if $assembly/math/clamp255|inlined.15
        drop
        local.get $26
        i32.trunc_sat_f32_u
       end
       i32.const 255
       i32.and
       i32.const 16
       i32.shl
       i32.or
       block $assembly/math/clamp255|inlined.16 (result i32)
        i32.const 0
        local.get $27
        local.get $27
        f32.ne
        br_if $assembly/math/clamp255|inlined.16
        drop
        i32.const 0
        local.get $27
        f32.const 0
        f32.lt
        br_if $assembly/math/clamp255|inlined.16
        drop
        i32.const 255
        local.get $27
        f32.const 255
        f32.gt
        br_if $assembly/math/clamp255|inlined.16
        drop
        local.get $27
        i32.trunc_sat_f32_u
       end
       i32.const 255
       i32.and
       i32.const 24
       i32.shl
       i32.or
      end
      i32.store
      local.get $8
      i32.const 1
      i32.add
      local.set $8
      br $for-loop|1
     end
    end
    local.get $5
    i32.const 1
    i32.add
    local.set $5
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/pinch (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 f32) (param $5 i32) (param $6 i32)
  (local $7 i32)
  (local $8 f32)
  (local $9 i32)
  (local $10 f32)
  (local $11 i32)
  (local $12 f32)
  (local $13 f32)
  (local $14 f32)
  (local $15 f32)
  (local $16 i32)
  (local $17 i32)
  (local $18 i32)
  (local $19 i32)
  (local $20 f32)
  (local $21 f32)
  (local $22 f32)
  (local $23 f32)
  (local $24 f32)
  local.get $2
  f32.convert_i32_s
  f32.const 0.5
  f32.mul
  local.set $12
  local.get $3
  f32.convert_i32_s
  f32.const 0.5
  f32.mul
  local.set $13
  local.get $2
  f64.convert_i32_s
  local.get $3
  f64.convert_i32_s
  f64.min
  f32.demote_f64
  f32.const 0.5
  f32.mul
  local.set $14
  loop $for-loop|0
   local.get $5
   local.get $6
   i32.lt_s
   if
    local.get $2
    local.get $5
    i32.mul
    i32.const 2
    i32.shl
    local.set $9
    local.get $5
    f32.convert_i32_s
    local.get $13
    f32.sub
    local.set $10
    i32.const 0
    local.set $7
    loop $for-loop|1
     local.get $2
     local.get $7
     i32.gt_s
     if
      local.get $7
      f32.convert_i32_s
      local.get $12
      f32.sub
      local.tee $8
      local.get $8
      f32.mul
      local.get $10
      local.get $10
      f32.mul
      f32.add
      f64.promote_f32
      f64.sqrt
      f32.demote_f64
      local.tee $15
      local.get $14
      f32.lt
      if
       local.get $1
       local.get $9
       i32.add
       local.get $7
       i32.const 2
       i32.shl
       i32.add
       block $assembly/math/sampleBilinear|inlined.2 (result i32)
        local.get $12
        local.get $8
        local.get $15
        local.get $14
        f32.div
        f64.promote_f32
        local.get $4
        f64.promote_f32
        call $~lib/math/NativeMath.pow
        f32.demote_f64
        local.tee $8
        f32.mul
        f32.add
        local.set $15
        i32.const 0
        local.get $13
        local.get $10
        local.get $8
        f32.mul
        f32.add
        local.tee $8
        local.get $8
        f32.ne
        local.get $15
        local.get $15
        f32.ne
        i32.or
        br_if $assembly/math/sampleBilinear|inlined.2
        drop
        local.get $2
        f64.convert_i32_s
        f64.const -1.000001
        f64.add
        f32.demote_f64
        f32.const 0
        local.get $15
        local.get $15
        f32.const 0
        f32.lt
        select
        local.tee $15
        local.get $15
        local.get $2
        f32.convert_i32_s
        f32.const -1
        f32.add
        f32.ge
        select
        local.tee $15
        f64.promote_f32
        f64.floor
        i32.trunc_sat_f64_s
        local.tee $16
        i32.const 1
        i32.add
        local.set $17
        local.get $3
        f64.convert_i32_s
        f64.const -1.000001
        f64.add
        f32.demote_f64
        f32.const 0
        local.get $8
        local.get $8
        f32.const 0
        f32.lt
        select
        local.tee $8
        local.get $8
        local.get $3
        f32.convert_i32_s
        f32.const -1
        f32.add
        f32.ge
        select
        local.tee $8
        local.get $8
        f64.promote_f32
        f64.floor
        i32.trunc_sat_f64_s
        local.tee $18
        f32.convert_i32_s
        f32.sub
        local.set $8
        local.get $2
        local.get $18
        i32.mul
        local.tee $19
        local.get $16
        i32.add
        i32.const 2
        i32.shl
        local.get $0
        i32.add
        local.tee $11
        i32.load8_u
        f32.convert_i32_u
        local.tee $20
        local.get $17
        local.get $19
        i32.add
        i32.const 2
        i32.shl
        local.get $0
        i32.add
        local.tee $19
        i32.load8_u
        f32.convert_i32_u
        local.get $20
        f32.sub
        local.get $15
        local.get $16
        f32.convert_i32_s
        f32.sub
        local.tee $20
        f32.mul
        f32.add
        local.set $15
        local.get $11
        i32.load8_u offset=1
        f32.convert_i32_u
        local.tee $21
        local.get $19
        i32.load8_u offset=1
        f32.convert_i32_u
        local.get $21
        f32.sub
        local.get $20
        f32.mul
        f32.add
        local.tee $21
        local.get $18
        i32.const 1
        i32.add
        local.get $2
        i32.mul
        local.tee $18
        local.get $16
        i32.add
        i32.const 2
        i32.shl
        local.get $0
        i32.add
        local.tee $16
        i32.load8_u offset=1
        f32.convert_i32_u
        local.tee $22
        local.get $17
        local.get $18
        i32.add
        i32.const 2
        i32.shl
        local.get $0
        i32.add
        local.tee $17
        i32.load8_u offset=1
        f32.convert_i32_u
        local.get $22
        f32.sub
        local.get $20
        f32.mul
        f32.add
        local.get $21
        f32.sub
        local.get $8
        f32.mul
        f32.add
        local.set $21
        local.get $11
        i32.load8_u offset=2
        f32.convert_i32_u
        local.tee $22
        local.get $19
        i32.load8_u offset=2
        f32.convert_i32_u
        local.get $22
        f32.sub
        local.get $20
        f32.mul
        f32.add
        local.tee $22
        local.get $16
        i32.load8_u offset=2
        f32.convert_i32_u
        local.tee $23
        local.get $17
        i32.load8_u offset=2
        f32.convert_i32_u
        local.get $23
        f32.sub
        local.get $20
        f32.mul
        f32.add
        local.get $22
        f32.sub
        local.get $8
        f32.mul
        f32.add
        local.set $22
        local.get $11
        i32.load8_u offset=3
        f32.convert_i32_u
        local.tee $23
        local.get $19
        i32.load8_u offset=3
        f32.convert_i32_u
        local.get $23
        f32.sub
        local.get $20
        f32.mul
        f32.add
        local.tee $23
        local.get $16
        i32.load8_u offset=3
        f32.convert_i32_u
        local.tee $24
        local.get $17
        i32.load8_u offset=3
        f32.convert_i32_u
        local.get $24
        f32.sub
        local.get $20
        f32.mul
        f32.add
        local.get $23
        f32.sub
        local.get $8
        f32.mul
        f32.add
        local.set $23
        block $assembly/math/clamp255|inlined.17 (result i32)
         i32.const 0
         local.get $15
         local.get $16
         i32.load8_u
         f32.convert_i32_u
         local.tee $24
         local.get $17
         i32.load8_u
         f32.convert_i32_u
         local.get $24
         f32.sub
         local.get $20
         f32.mul
         f32.add
         local.get $15
         f32.sub
         local.get $8
         f32.mul
         f32.add
         local.tee $8
         local.get $8
         f32.ne
         br_if $assembly/math/clamp255|inlined.17
         drop
         i32.const 0
         local.get $8
         f32.const 0
         f32.lt
         br_if $assembly/math/clamp255|inlined.17
         drop
         i32.const 255
         local.get $8
         f32.const 255
         f32.gt
         br_if $assembly/math/clamp255|inlined.17
         drop
         local.get $8
         i32.trunc_sat_f32_u
        end
        i32.const 255
        i32.and
        block $assembly/math/clamp255|inlined.18 (result i32)
         i32.const 0
         local.get $21
         local.get $21
         f32.ne
         br_if $assembly/math/clamp255|inlined.18
         drop
         i32.const 0
         local.get $21
         f32.const 0
         f32.lt
         br_if $assembly/math/clamp255|inlined.18
         drop
         i32.const 255
         local.get $21
         f32.const 255
         f32.gt
         br_if $assembly/math/clamp255|inlined.18
         drop
         local.get $21
         i32.trunc_sat_f32_u
        end
        i32.const 255
        i32.and
        i32.const 8
        i32.shl
        i32.or
        block $assembly/math/clamp255|inlined.19 (result i32)
         i32.const 0
         local.get $22
         local.get $22
         f32.ne
         br_if $assembly/math/clamp255|inlined.19
         drop
         i32.const 0
         local.get $22
         f32.const 0
         f32.lt
         br_if $assembly/math/clamp255|inlined.19
         drop
         i32.const 255
         local.get $22
         f32.const 255
         f32.gt
         br_if $assembly/math/clamp255|inlined.19
         drop
         local.get $22
         i32.trunc_sat_f32_u
        end
        i32.const 255
        i32.and
        i32.const 16
        i32.shl
        i32.or
        block $assembly/math/clamp255|inlined.20 (result i32)
         i32.const 0
         local.get $23
         local.get $23
         f32.ne
         br_if $assembly/math/clamp255|inlined.20
         drop
         i32.const 0
         local.get $23
         f32.const 0
         f32.lt
         br_if $assembly/math/clamp255|inlined.20
         drop
         i32.const 255
         local.get $23
         f32.const 255
         f32.gt
         br_if $assembly/math/clamp255|inlined.20
         drop
         local.get $23
         i32.trunc_sat_f32_u
        end
        i32.const 255
        i32.and
        i32.const 24
        i32.shl
        i32.or
       end
       i32.store
      else
       local.get $7
       i32.const 2
       i32.shl
       local.tee $11
       local.get $1
       local.get $9
       i32.add
       i32.add
       local.get $0
       local.get $9
       i32.add
       local.get $11
       i32.add
       i32.load
       i32.store
      end
      local.get $7
      i32.const 1
      i32.add
      local.set $7
      br $for-loop|1
     end
    end
    local.get $5
    i32.const 1
    i32.add
    local.set $5
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/vignette (param $0 i32) (param $1 i32) (param $2 i32) (param $3 f32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32) (param $8 i32) (param $9 i32)
  (local $10 f32)
  (local $11 f32)
  (local $12 f32)
  (local $13 f32)
  (local $14 f32)
  (local $15 f32)
  (local $16 f32)
  (local $17 f32)
  (local $18 f32)
  (local $19 f32)
  (local $20 f32)
  (local $21 f32)
  (local $22 f32)
  (local $23 f32)
  local.get $1
  f32.convert_i32_s
  f32.const 0.5
  f32.mul
  local.tee $18
  local.get $18
  f32.mul
  local.get $2
  f32.convert_i32_s
  f32.const 0.5
  f32.mul
  local.tee $19
  local.get $19
  f32.mul
  f32.add
  f64.promote_f32
  f64.sqrt
  f32.demote_f64
  local.set $20
  local.get $4
  i32.const 255
  i32.and
  f32.convert_i32_u
  f32.const 255
  f32.div
  local.set $11
  local.get $5
  i32.const 255
  i32.and
  f32.convert_i32_u
  f32.const 255
  f32.div
  local.set $12
  local.get $6
  i32.const 255
  i32.and
  f32.convert_i32_u
  f32.const 255
  f32.div
  local.set $17
  loop $for-loop|0
   local.get $8
   local.get $9
   i32.lt_s
   if
    local.get $1
    local.get $8
    i32.mul
    i32.const 2
    i32.shl
    local.set $4
    local.get $8
    f32.convert_i32_s
    local.get $19
    f32.sub
    local.tee $10
    local.get $10
    f32.mul
    local.set $21
    i32.const 0
    local.set $2
    loop $for-loop|1
     local.get $1
     local.get $2
     i32.gt_s
     if
      local.get $4
      local.get $2
      i32.const 2
      i32.shl
      i32.add
      local.set $5
      local.get $2
      f32.convert_i32_s
      local.get $18
      f32.sub
      local.tee $10
      local.get $10
      f32.mul
      local.get $21
      f32.add
      f64.promote_f32
      f64.sqrt
      f32.demote_f64
      local.get $20
      f32.div
      local.get $3
      f32.mul
      f32.const 2
      f32.mul
      local.tee $10
      f32.const 0.20000000298023224
      f32.le
      if (result f32)
       f32.const 1
      else
       local.get $10
       f32.const 0.800000011920929
       f32.ge
       if (result f32)
        f32.const 0
       else
        local.get $10
        f32.const -0.800000011920929
        f32.add
        f32.const -0.6000000238418579
        f32.div
        local.tee $10
        local.get $10
        f32.mul
        f32.const 3
        local.get $10
        local.get $10
        f32.add
        f32.sub
        f32.mul
       end
      end
      local.set $23
      local.get $0
      local.get $5
      i32.add
      local.tee $6
      i32.load8_u
      f32.convert_i32_u
      f32.const 255
      f32.div
      local.set $14
      local.get $6
      i32.load8_u offset=1
      f32.convert_i32_u
      f32.const 255
      f32.div
      local.set $15
      local.get $6
      i32.load8_u offset=2
      f32.convert_i32_u
      f32.const 255
      f32.div
      local.set $16
      local.get $7
      i32.const 1
      i32.eq
      if (result f32)
       local.get $14
       local.get $11
       f32.mul
       local.set $10
       local.get $15
       local.get $12
       f32.mul
       local.set $13
       local.get $16
       local.get $17
       f32.mul
      else
       local.get $7
       i32.const 2
       i32.eq
       if (result f32)
        f32.const 1
        f32.const 1
        local.get $14
        f32.sub
        f32.const 1
        local.get $11
        f32.sub
        f32.mul
        f32.sub
        local.set $10
        f32.const 1
        f32.const 1
        local.get $15
        f32.sub
        f32.const 1
        local.get $12
        f32.sub
        f32.mul
        f32.sub
        local.set $13
        f32.const 1
        f32.const 1
        local.get $16
        f32.sub
        f32.const 1
        local.get $17
        f32.sub
        f32.mul
        f32.sub
       else
        local.get $7
        i32.const 3
        i32.eq
        if (result f32)
         local.get $14
         f32.const 0.5
         f32.lt
         if (result f32)
          local.get $14
          local.get $14
          f32.add
          local.get $11
          f32.mul
         else
          f32.const 1
          f32.const 1
          local.get $14
          f32.sub
          f32.const 2
          f32.mul
          f32.const 1
          local.get $11
          f32.sub
          f32.mul
          f32.sub
         end
         local.set $10
         local.get $15
         f32.const 0.5
         f32.lt
         if (result f32)
          local.get $15
          local.get $15
          f32.add
          local.get $12
          f32.mul
         else
          f32.const 1
          f32.const 1
          local.get $15
          f32.sub
          f32.const 2
          f32.mul
          f32.const 1
          local.get $12
          f32.sub
          f32.mul
          f32.sub
         end
         local.set $13
         local.get $16
         f32.const 0.5
         f32.lt
         if (result f32)
          local.get $16
          local.get $16
          f32.add
          local.get $17
          f32.mul
         else
          f32.const 1
          f32.const 1
          local.get $16
          f32.sub
          f32.const 2
          f32.mul
          f32.const 1
          local.get $17
          f32.sub
          f32.mul
          f32.sub
         end
        else
         local.get $11
         local.set $10
         local.get $12
         local.set $13
         local.get $17
        end
       end
      end
      local.set $22
      local.get $0
      local.get $5
      i32.add
      block $assembly/math/clamp255|inlined.21 (result i32)
       i32.const 0
       local.get $14
       local.get $23
       f32.mul
       local.get $10
       f32.const 1
       local.get $23
       f32.sub
       f32.mul
       f32.add
       f32.const 255
       f32.mul
       local.tee $10
       local.get $10
       f32.ne
       br_if $assembly/math/clamp255|inlined.21
       drop
       i32.const 0
       local.get $10
       f32.const 0
       f32.lt
       br_if $assembly/math/clamp255|inlined.21
       drop
       i32.const 255
       local.get $10
       f32.const 255
       f32.gt
       br_if $assembly/math/clamp255|inlined.21
       drop
       local.get $10
       i32.trunc_sat_f32_u
      end
      i32.store8
      local.get $0
      local.get $5
      i32.add
      block $assembly/math/clamp255|inlined.22 (result i32)
       i32.const 0
       local.get $15
       local.get $23
       f32.mul
       local.get $13
       f32.const 1
       local.get $23
       f32.sub
       f32.mul
       f32.add
       f32.const 255
       f32.mul
       local.tee $10
       local.get $10
       f32.ne
       br_if $assembly/math/clamp255|inlined.22
       drop
       i32.const 0
       local.get $10
       f32.const 0
       f32.lt
       br_if $assembly/math/clamp255|inlined.22
       drop
       i32.const 255
       local.get $10
       f32.const 255
       f32.gt
       br_if $assembly/math/clamp255|inlined.22
       drop
       local.get $10
       i32.trunc_sat_f32_u
      end
      i32.store8 offset=1
      local.get $0
      local.get $5
      i32.add
      block $assembly/math/clamp255|inlined.23 (result i32)
       i32.const 0
       local.get $16
       local.get $23
       f32.mul
       local.get $22
       f32.const 1
       local.get $23
       f32.sub
       f32.mul
       f32.add
       f32.const 255
       f32.mul
       local.tee $10
       local.get $10
       f32.ne
       br_if $assembly/math/clamp255|inlined.23
       drop
       i32.const 0
       local.get $10
       f32.const 0
       f32.lt
       br_if $assembly/math/clamp255|inlined.23
       drop
       i32.const 255
       local.get $10
       f32.const 255
       f32.gt
       br_if $assembly/math/clamp255|inlined.23
       drop
       local.get $10
       i32.trunc_sat_f32_u
      end
      i32.store8 offset=2
      local.get $2
      i32.const 1
      i32.add
      local.set $2
      br $for-loop|1
     end
    end
    local.get $8
    i32.const 1
    i32.add
    local.set $8
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/adjustBCS (param $0 i32) (param $1 i32) (param $2 i32) (param $3 f32) (param $4 f32) (param $5 i32) (param $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  (local $10 i32)
  (local $11 i32)
  (local $12 f32)
  local.get $3
  f32.const 100
  f32.div
  local.set $12
  local.get $4
  f32.const 100
  f32.add
  f32.const 100
  f32.div
  local.set $4
  loop $for-loop|0
   local.get $5
   local.get $6
   i32.lt_s
   if
    local.get $1
    local.get $5
    i32.mul
    i32.const 2
    i32.shl
    local.set $8
    i32.const 0
    local.set $2
    loop $for-loop|1
     local.get $1
     local.get $2
     i32.gt_s
     if
      local.get $8
      local.get $2
      i32.const 2
      i32.shl
      i32.add
      local.set $9
      i32.const 0
      local.set $7
      loop $for-loop|2
       local.get $7
       i32.const 3
       i32.lt_u
       if
        block $assembly/math/clamp255|inlined.24 (result i32)
         i32.const 0
         local.get $0
         local.get $9
         i32.add
         local.get $7
         i32.add
         local.tee $10
         i32.load8_u
         f32.convert_i32_u
         f32.const 255
         f32.div
         f32.const -0.5
         f32.add
         local.get $4
         f32.mul
         f32.const 0.5
         f32.add
         local.get $12
         f32.add
         f32.const 255
         f32.mul
         local.tee $3
         local.get $3
         f32.ne
         br_if $assembly/math/clamp255|inlined.24
         drop
         i32.const 0
         local.get $3
         f32.const 0
         f32.lt
         br_if $assembly/math/clamp255|inlined.24
         drop
         i32.const 255
         local.get $3
         f32.const 255
         f32.gt
         br_if $assembly/math/clamp255|inlined.24
         drop
         local.get $3
         i32.trunc_sat_f32_u
        end
        local.set $11
        local.get $10
        local.get $11
        i32.store8
        local.get $7
        i32.const 1
        i32.add
        local.set $7
        br $for-loop|2
       end
      end
      local.get $2
      i32.const 1
      i32.add
      local.set $2
      br $for-loop|1
     end
    end
    local.get $5
    i32.const 1
    i32.add
    local.set $5
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/invert (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32)
  (local $5 i32)
  (local $6 i32)
  loop $for-loop|0
   local.get $3
   local.get $4
   i32.lt_s
   if
    local.get $1
    local.get $3
    i32.mul
    i32.const 2
    i32.shl
    local.set $6
    i32.const 0
    local.set $2
    loop $for-loop|1
     local.get $1
     local.get $2
     i32.gt_s
     if
      local.get $0
      local.get $6
      local.get $2
      i32.const 2
      i32.shl
      i32.add
      i32.add
      local.tee $5
      i32.const 255
      local.get $5
      i32.load8_u
      i32.sub
      i32.store8
      local.get $5
      i32.const 1
      i32.add
      i32.const 255
      local.get $5
      i32.load8_u offset=1
      i32.sub
      i32.store8
      local.get $5
      i32.const 2
      i32.add
      i32.const 255
      local.get $5
      i32.load8_u offset=2
      i32.sub
      i32.store8
      local.get $2
      i32.const 1
      i32.add
      local.set $2
      br $for-loop|1
     end
    end
    local.get $3
    i32.const 1
    i32.add
    local.set $3
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/grayscale (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  loop $for-loop|0
   local.get $3
   local.get $4
   i32.lt_s
   if
    local.get $1
    local.get $3
    i32.mul
    i32.const 2
    i32.shl
    local.set $6
    i32.const 0
    local.set $2
    loop $for-loop|1
     local.get $1
     local.get $2
     i32.gt_s
     if
      local.get $0
      local.get $6
      local.get $2
      i32.const 2
      i32.shl
      i32.add
      i32.add
      local.tee $5
      local.get $5
      i32.load8_u
      f32.convert_i32_u
      f64.promote_f32
      f64.const 0.299
      f64.mul
      local.get $5
      i32.load8_u offset=1
      f32.convert_i32_u
      f64.promote_f32
      f64.const 0.587
      f64.mul
      f64.add
      local.get $5
      i32.const 2
      i32.add
      i32.load8_u
      f32.convert_i32_u
      f64.promote_f32
      f64.const 0.114
      f64.mul
      f64.add
      i32.trunc_sat_f64_u
      local.tee $7
      i32.store8
      local.get $5
      local.get $7
      i32.store8 offset=1
      local.get $5
      local.get $7
      i32.store8 offset=2
      local.get $2
      i32.const 1
      i32.add
      local.set $2
      br $for-loop|1
     end
    end
    local.get $3
    i32.const 1
    i32.add
    local.set $3
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/posterize (param $0 i32) (param $1 i32) (param $2 i32) (param $3 f32) (param $4 i32) (param $5 i32)
  (local $6 i32)
  (local $7 f64)
  (local $8 i32)
  f64.const 255
  local.get $3
  f32.const -1
  f32.add
  f64.promote_f32
  f64.div
  local.set $7
  loop $for-loop|0
   local.get $4
   local.get $5
   i32.lt_s
   if
    local.get $1
    local.get $4
    i32.mul
    i32.const 2
    i32.shl
    local.set $8
    i32.const 0
    local.set $2
    loop $for-loop|1
     local.get $1
     local.get $2
     i32.gt_s
     if
      local.get $8
      local.get $2
      i32.const 2
      i32.shl
      i32.add
      local.get $0
      i32.add
      local.tee $6
      local.get $6
      i32.load8_u
      f64.convert_i32_u
      local.get $7
      f64.div
      f64.floor
      local.get $7
      f64.mul
      i32.trunc_sat_f64_u
      i32.store8
      local.get $6
      i32.const 1
      i32.add
      local.get $6
      i32.load8_u offset=1
      f64.convert_i32_u
      local.get $7
      f64.div
      f64.floor
      local.get $7
      f64.mul
      i32.trunc_sat_f64_u
      i32.store8
      local.get $6
      i32.const 2
      i32.add
      local.get $6
      i32.load8_u offset=2
      f64.convert_i32_u
      local.get $7
      f64.div
      f64.floor
      local.get $7
      f64.mul
      i32.trunc_sat_f64_u
      i32.store8
      local.get $2
      i32.const 1
      i32.add
      local.set $2
      br $for-loop|1
     end
    end
    local.get $4
    i32.const 1
    i32.add
    local.set $4
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/boxBlur (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  (local $10 i32)
  (local $11 i32)
  (local $12 i32)
  (local $13 i32)
  (local $14 i32)
  (local $15 i32)
  (local $16 i32)
  loop $for-loop|0
   local.get $5
   local.get $6
   i32.lt_s
   if
    local.get $2
    local.get $5
    i32.mul
    i32.const 2
    i32.shl
    local.set $14
    i32.const 0
    local.set $10
    loop $for-loop|1
     local.get $2
     local.get $10
     i32.gt_s
     if
      i32.const 0
      local.set $11
      i32.const 0
      local.set $12
      i32.const 0
      local.set $13
      i32.const 0
      local.set $7
      i32.const 0
      local.get $4
      i32.sub
      local.set $8
      loop $for-loop|2
       local.get $4
       local.get $8
       i32.ge_s
       if
        local.get $5
        local.get $8
        i32.add
        local.tee $15
        i32.const 0
        i32.lt_s
        local.get $3
        local.get $15
        i32.le_s
        i32.or
        i32.eqz
        if
         i32.const 0
         local.get $4
         i32.sub
         local.set $9
         loop $for-loop|3
          local.get $4
          local.get $9
          i32.ge_s
          if
           local.get $9
           local.get $10
           i32.add
           local.tee $16
           i32.const 0
           i32.lt_s
           local.get $2
           local.get $16
           i32.le_s
           i32.or
           i32.eqz
           if
            local.get $11
            local.get $0
            local.get $2
            local.get $15
            i32.mul
            local.get $16
            i32.add
            i32.const 2
            i32.shl
            i32.add
            local.tee $16
            i32.load8_u
            i32.add
            local.set $11
            local.get $12
            local.get $16
            i32.load8_u offset=1
            i32.add
            local.set $12
            local.get $13
            local.get $16
            i32.load8_u offset=2
            i32.add
            local.set $13
            local.get $7
            i32.const 1
            i32.add
            local.set $7
           end
           local.get $9
           i32.const 1
           i32.add
           local.set $9
           br $for-loop|3
          end
         end
        end
        local.get $8
        i32.const 1
        i32.add
        local.set $8
        br $for-loop|2
       end
      end
      local.get $10
      i32.const 2
      i32.shl
      local.tee $8
      local.get $1
      local.get $14
      i32.add
      i32.add
      local.tee $9
      local.get $11
      local.get $7
      i32.div_u
      i32.store8
      local.get $9
      local.get $12
      local.get $7
      i32.div_u
      i32.store8 offset=1
      local.get $9
      local.get $13
      local.get $7
      i32.div_u
      i32.store8 offset=2
      local.get $9
      local.get $0
      local.get $14
      i32.add
      local.get $8
      i32.add
      i32.load8_u offset=3
      i32.store8 offset=3
      local.get $10
      i32.const 1
      i32.add
      local.set $10
      br $for-loop|1
     end
    end
    local.get $5
    i32.const 1
    i32.add
    local.set $5
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/crystallize (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 f32) (param $5 i32) (param $6 i32)
  (local $7 f64)
  (local $8 i32)
  (local $9 i32)
  (local $10 i32)
  f32.const 1
  local.get $4
  local.get $4
  f32.const 1
  f32.lt
  select
  local.set $4
  loop $for-loop|0
   local.get $5
   local.get $6
   i32.lt_s
   if
    local.get $2
    local.get $5
    i32.mul
    i32.const 2
    i32.shl
    local.set $9
    local.get $5
    f64.convert_i32_s
    local.get $4
    f64.promote_f32
    local.tee $7
    f64.div
    f64.floor
    local.get $7
    f64.mul
    local.get $7
    f64.const 0.5
    f64.mul
    f64.add
    i32.trunc_sat_f64_s
    f64.convert_i32_s
    local.get $3
    f64.convert_i32_s
    f64.const -1
    f64.add
    f64.min
    i32.trunc_sat_f64_u
    local.set $10
    i32.const 0
    local.set $8
    loop $for-loop|1
     local.get $2
     local.get $8
     i32.gt_s
     if
      local.get $1
      local.get $9
      i32.add
      local.get $8
      i32.const 2
      i32.shl
      i32.add
      local.get $0
      local.get $8
      f64.convert_i32_s
      local.get $4
      f64.promote_f32
      local.tee $7
      f64.div
      f64.floor
      local.get $7
      f64.mul
      local.get $7
      f64.const 0.5
      f64.mul
      f64.add
      i32.trunc_sat_f64_s
      f64.convert_i32_s
      local.get $2
      f64.convert_i32_s
      f64.const -1
      f64.add
      f64.min
      i32.trunc_sat_f64_u
      local.get $2
      local.get $10
      i32.mul
      i32.add
      i32.const 2
      i32.shl
      i32.add
      i32.load
      i32.store
      local.get $8
      i32.const 1
      i32.add
      local.set $8
      br $for-loop|1
     end
    end
    local.get $5
    i32.const 1
    i32.add
    local.set $5
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/softglow (param $0 i32) (param $1 i32) (param $2 i32) (param $3 f32) (param $4 i32) (param $5 i32)
  (local $6 f32)
  (local $7 f32)
  (local $8 f32)
  (local $9 i32)
  (local $10 i32)
  (local $11 i32)
  (local $12 f32)
  loop $for-loop|0
   local.get $4
   local.get $5
   i32.lt_s
   if
    local.get $1
    local.get $4
    i32.mul
    i32.const 2
    i32.shl
    local.set $11
    i32.const 0
    local.set $2
    loop $for-loop|1
     local.get $1
     local.get $2
     i32.gt_s
     if
      local.get $11
      local.get $2
      i32.const 2
      i32.shl
      i32.add
      local.tee $9
      local.get $0
      i32.add
      local.tee $10
      i32.load8_u
      f32.convert_i32_u
      local.tee $7
      f32.const 0.29899999499320984
      f32.mul
      local.get $10
      i32.load8_u offset=1
      f32.convert_i32_u
      local.tee $6
      f32.const 0.5870000123977661
      f32.mul
      f32.add
      local.get $10
      i32.load8_u offset=2
      f32.convert_i32_u
      local.tee $8
      f32.const 0.11400000005960464
      f32.mul
      f32.add
      local.tee $12
      f32.const 128
      f32.gt
      if
       local.get $7
       local.get $7
       local.get $12
       f32.const -128
       f32.add
       f32.const 127
       f32.div
       local.get $3
       f32.mul
       local.tee $12
       f32.mul
       f32.add
       local.set $7
       local.get $8
       local.get $8
       local.get $12
       f32.mul
       f32.add
       local.set $8
       local.get $6
       local.get $6
       local.get $12
       f32.mul
       f32.add
       local.set $6
      end
      local.get $0
      local.get $9
      i32.add
      block $assembly/math/clamp255|inlined.25 (result i32)
       i32.const 0
       local.get $7
       local.get $7
       f32.ne
       br_if $assembly/math/clamp255|inlined.25
       drop
       i32.const 0
       local.get $7
       f32.const 0
       f32.lt
       br_if $assembly/math/clamp255|inlined.25
       drop
       i32.const 255
       local.get $7
       f32.const 255
       f32.gt
       br_if $assembly/math/clamp255|inlined.25
       drop
       local.get $7
       i32.trunc_sat_f32_u
      end
      i32.store8
      local.get $0
      local.get $9
      i32.add
      block $assembly/math/clamp255|inlined.26 (result i32)
       i32.const 0
       local.get $6
       local.get $6
       f32.ne
       br_if $assembly/math/clamp255|inlined.26
       drop
       i32.const 0
       local.get $6
       f32.const 0
       f32.lt
       br_if $assembly/math/clamp255|inlined.26
       drop
       i32.const 255
       local.get $6
       f32.const 255
       f32.gt
       br_if $assembly/math/clamp255|inlined.26
       drop
       local.get $6
       i32.trunc_sat_f32_u
      end
      i32.store8 offset=1
      local.get $0
      local.get $9
      i32.add
      block $assembly/math/clamp255|inlined.27 (result i32)
       i32.const 0
       local.get $8
       local.get $8
       f32.ne
       br_if $assembly/math/clamp255|inlined.27
       drop
       i32.const 0
       local.get $8
       f32.const 0
       f32.lt
       br_if $assembly/math/clamp255|inlined.27
       drop
       i32.const 255
       local.get $8
       f32.const 255
       f32.gt
       br_if $assembly/math/clamp255|inlined.27
       drop
       local.get $8
       i32.trunc_sat_f32_u
      end
      i32.store8 offset=2
      local.get $2
      i32.const 1
      i32.add
      local.set $2
      br $for-loop|1
     end
    end
    local.get $4
    i32.const 1
    i32.add
    local.set $4
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/resize (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32)
  (local $6 f32)
  (local $7 i32)
  (local $8 i32)
  (local $9 f32)
  (local $10 i32)
  (local $11 f32)
  (local $12 f32)
  (local $13 f32)
  (local $14 i32)
  (local $15 i32)
  (local $16 i32)
  (local $17 i32)
  (local $18 i32)
  (local $19 f32)
  (local $20 f32)
  (local $21 f32)
  (local $22 f32)
  (local $23 f32)
  local.get $2
  f32.convert_i32_s
  local.get $4
  f32.convert_i32_s
  f32.div
  local.set $12
  local.get $3
  f32.convert_i32_s
  local.get $5
  f32.convert_i32_s
  f32.div
  local.set $13
  loop $for-loop|0
   local.get $5
   local.get $8
   i32.gt_s
   if
    local.get $4
    local.get $8
    i32.mul
    i32.const 2
    i32.shl
    local.set $14
    local.get $8
    f32.convert_i32_s
    local.get $13
    f32.mul
    local.set $6
    i32.const 0
    local.set $7
    loop $for-loop|1
     local.get $4
     local.get $7
     i32.gt_s
     if
      local.get $1
      local.get $14
      i32.add
      local.get $7
      i32.const 2
      i32.shl
      i32.add
      local.get $6
      local.get $6
      f32.ne
      local.get $7
      f32.convert_i32_s
      local.get $12
      f32.mul
      local.tee $9
      local.get $9
      f32.ne
      i32.or
      if (result i32)
       i32.const 0
      else
       local.get $2
       f64.convert_i32_s
       f64.const -1.000001
       f64.add
       f32.demote_f64
       f32.const 0
       local.get $9
       local.get $9
       f32.const 0
       f32.lt
       select
       local.tee $9
       local.get $9
       local.get $2
       f32.convert_i32_s
       f32.const -1
       f32.add
       f32.ge
       select
       local.tee $11
       f64.promote_f32
       f64.floor
       i32.trunc_sat_f64_s
       local.tee $15
       i32.const 1
       i32.add
       local.set $16
       local.get $3
       f64.convert_i32_s
       f64.const -1.000001
       f64.add
       f32.demote_f64
       f32.const 0
       local.get $6
       local.get $6
       f32.const 0
       f32.lt
       select
       local.tee $9
       local.get $9
       local.get $3
       f32.convert_i32_s
       f32.const -1
       f32.add
       f32.ge
       select
       local.tee $9
       local.get $9
       f64.promote_f32
       f64.floor
       i32.trunc_sat_f64_s
       local.tee $17
       f32.convert_i32_s
       f32.sub
       local.set $9
       local.get $2
       local.get $17
       i32.mul
       local.tee $18
       local.get $15
       i32.add
       i32.const 2
       i32.shl
       local.get $0
       i32.add
       local.tee $10
       i32.load8_u
       f32.convert_i32_u
       local.tee $19
       local.get $16
       local.get $18
       i32.add
       i32.const 2
       i32.shl
       local.get $0
       i32.add
       local.tee $18
       i32.load8_u
       f32.convert_i32_u
       local.get $19
       f32.sub
       local.get $11
       local.get $15
       f32.convert_i32_s
       f32.sub
       local.tee $19
       f32.mul
       f32.add
       local.set $11
       local.get $10
       i32.load8_u offset=1
       f32.convert_i32_u
       local.tee $20
       local.get $18
       i32.load8_u offset=1
       f32.convert_i32_u
       local.get $20
       f32.sub
       local.get $19
       f32.mul
       f32.add
       local.tee $20
       local.get $17
       i32.const 1
       i32.add
       local.get $2
       i32.mul
       local.tee $17
       local.get $15
       i32.add
       i32.const 2
       i32.shl
       local.get $0
       i32.add
       local.tee $15
       i32.load8_u offset=1
       f32.convert_i32_u
       local.tee $21
       local.get $16
       local.get $17
       i32.add
       i32.const 2
       i32.shl
       local.get $0
       i32.add
       local.tee $16
       i32.load8_u offset=1
       f32.convert_i32_u
       local.get $21
       f32.sub
       local.get $19
       f32.mul
       f32.add
       local.get $20
       f32.sub
       local.get $9
       f32.mul
       f32.add
       local.set $20
       local.get $10
       i32.load8_u offset=2
       f32.convert_i32_u
       local.tee $21
       local.get $18
       i32.load8_u offset=2
       f32.convert_i32_u
       local.get $21
       f32.sub
       local.get $19
       f32.mul
       f32.add
       local.tee $21
       local.get $15
       i32.load8_u offset=2
       f32.convert_i32_u
       local.tee $22
       local.get $16
       i32.load8_u offset=2
       f32.convert_i32_u
       local.get $22
       f32.sub
       local.get $19
       f32.mul
       f32.add
       local.get $21
       f32.sub
       local.get $9
       f32.mul
       f32.add
       local.set $21
       local.get $10
       i32.load8_u offset=3
       f32.convert_i32_u
       local.tee $22
       local.get $18
       i32.load8_u offset=3
       f32.convert_i32_u
       local.get $22
       f32.sub
       local.get $19
       f32.mul
       f32.add
       local.tee $22
       local.get $15
       i32.load8_u offset=3
       f32.convert_i32_u
       local.tee $23
       local.get $16
       i32.load8_u offset=3
       f32.convert_i32_u
       local.get $23
       f32.sub
       local.get $19
       f32.mul
       f32.add
       local.get $22
       f32.sub
       local.get $9
       f32.mul
       f32.add
       local.set $22
       block $assembly/math/clamp255|inlined.28 (result i32)
        i32.const 0
        local.get $11
        local.get $15
        i32.load8_u
        f32.convert_i32_u
        local.tee $23
        local.get $16
        i32.load8_u
        f32.convert_i32_u
        local.get $23
        f32.sub
        local.get $19
        f32.mul
        f32.add
        local.get $11
        f32.sub
        local.get $9
        f32.mul
        f32.add
        local.tee $9
        local.get $9
        f32.ne
        br_if $assembly/math/clamp255|inlined.28
        drop
        i32.const 0
        local.get $9
        f32.const 0
        f32.lt
        br_if $assembly/math/clamp255|inlined.28
        drop
        i32.const 255
        local.get $9
        f32.const 255
        f32.gt
        br_if $assembly/math/clamp255|inlined.28
        drop
        local.get $9
        i32.trunc_sat_f32_u
       end
       i32.const 255
       i32.and
       block $assembly/math/clamp255|inlined.29 (result i32)
        i32.const 0
        local.get $20
        local.get $20
        f32.ne
        br_if $assembly/math/clamp255|inlined.29
        drop
        i32.const 0
        local.get $20
        f32.const 0
        f32.lt
        br_if $assembly/math/clamp255|inlined.29
        drop
        i32.const 255
        local.get $20
        f32.const 255
        f32.gt
        br_if $assembly/math/clamp255|inlined.29
        drop
        local.get $20
        i32.trunc_sat_f32_u
       end
       i32.const 255
       i32.and
       i32.const 8
       i32.shl
       i32.or
       block $assembly/math/clamp255|inlined.30 (result i32)
        i32.const 0
        local.get $21
        local.get $21
        f32.ne
        br_if $assembly/math/clamp255|inlined.30
        drop
        i32.const 0
        local.get $21
        f32.const 0
        f32.lt
        br_if $assembly/math/clamp255|inlined.30
        drop
        i32.const 255
        local.get $21
        f32.const 255
        f32.gt
        br_if $assembly/math/clamp255|inlined.30
        drop
        local.get $21
        i32.trunc_sat_f32_u
       end
       i32.const 255
       i32.and
       i32.const 16
       i32.shl
       i32.or
       block $assembly/math/clamp255|inlined.31 (result i32)
        i32.const 0
        local.get $22
        local.get $22
        f32.ne
        br_if $assembly/math/clamp255|inlined.31
        drop
        i32.const 0
        local.get $22
        f32.const 0
        f32.lt
        br_if $assembly/math/clamp255|inlined.31
        drop
        i32.const 255
        local.get $22
        f32.const 255
        f32.gt
        br_if $assembly/math/clamp255|inlined.31
        drop
        local.get $22
        i32.trunc_sat_f32_u
       end
       i32.const 255
       i32.and
       i32.const 24
       i32.shl
       i32.or
      end
      i32.store
      local.get $7
      i32.const 1
      i32.add
      local.set $7
      br $for-loop|1
     end
    end
    local.get $8
    i32.const 1
    i32.add
    local.set $8
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/pixelate (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  i32.const 1
  local.get $4
  local.get $4
  i32.const 0
  i32.le_s
  select
  local.set $7
  loop $for-loop|0
   local.get $5
   local.get $6
   i32.lt_s
   if
    local.get $2
    local.get $5
    i32.mul
    i32.const 2
    i32.shl
    local.set $8
    local.get $5
    local.get $7
    i32.div_s
    local.get $7
    i32.mul
    f64.convert_i32_s
    local.get $3
    f64.convert_i32_s
    f64.const -1
    f64.add
    f64.min
    i32.trunc_sat_f64_u
    local.set $9
    i32.const 0
    local.set $4
    loop $for-loop|1
     local.get $2
     local.get $4
     i32.gt_s
     if
      local.get $1
      local.get $8
      i32.add
      local.get $4
      i32.const 2
      i32.shl
      i32.add
      local.get $0
      local.get $4
      local.get $7
      i32.div_s
      local.get $7
      i32.mul
      f64.convert_i32_s
      local.get $2
      f64.convert_i32_s
      f64.const -1
      f64.add
      f64.min
      i32.trunc_sat_f64_u
      local.get $2
      local.get $9
      i32.mul
      i32.add
      i32.const 2
      i32.shl
      i32.add
      i32.load
      i32.store
      local.get $4
      i32.const 1
      i32.add
      local.set $4
      br $for-loop|1
     end
    end
    local.get $5
    i32.const 1
    i32.add
    local.set $5
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/sepia (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32)
  (local $5 f32)
  (local $6 i32)
  (local $7 i32)
  (local $8 f32)
  (local $9 i32)
  (local $10 i32)
  (local $11 f32)
  (local $12 f32)
  loop $for-loop|0
   local.get $3
   local.get $4
   i32.lt_s
   if
    local.get $1
    local.get $3
    i32.mul
    i32.const 2
    i32.shl
    local.set $9
    i32.const 0
    local.set $6
    loop $for-loop|1
     local.get $1
     local.get $6
     i32.gt_s
     if
      block $assembly/math/clamp255|inlined.32 (result i32)
       i32.const 0
       local.get $9
       local.get $6
       i32.const 2
       i32.shl
       i32.add
       local.tee $7
       local.get $0
       i32.add
       local.tee $2
       i32.load8_u
       f32.convert_i32_u
       local.tee $11
       f32.const 0.3930000066757202
       f32.mul
       local.get $2
       i32.load8_u offset=1
       f32.convert_i32_u
       local.tee $5
       f32.const 0.7689999938011169
       f32.mul
       f32.add
       local.get $2
       i32.load8_u offset=2
       f32.convert_i32_u
       local.tee $8
       f32.const 0.1889999955892563
       f32.mul
       f32.add
       local.tee $12
       local.get $12
       f32.ne
       br_if $assembly/math/clamp255|inlined.32
       drop
       i32.const 0
       local.get $12
       f32.const 0
       f32.lt
       br_if $assembly/math/clamp255|inlined.32
       drop
       i32.const 255
       local.get $12
       f32.const 255
       f32.gt
       br_if $assembly/math/clamp255|inlined.32
       drop
       local.get $12
       i32.trunc_sat_f32_u
      end
      local.set $10
      local.get $2
      local.get $10
      i32.store8
      local.get $0
      local.get $7
      i32.add
      block $assembly/math/clamp255|inlined.33 (result i32)
       i32.const 0
       local.get $11
       f32.const 0.3490000069141388
       f32.mul
       local.get $5
       f32.const 0.6859999895095825
       f32.mul
       f32.add
       local.get $8
       f32.const 0.1679999977350235
       f32.mul
       f32.add
       local.tee $12
       local.get $12
       f32.ne
       br_if $assembly/math/clamp255|inlined.33
       drop
       i32.const 0
       local.get $12
       f32.const 0
       f32.lt
       br_if $assembly/math/clamp255|inlined.33
       drop
       i32.const 255
       local.get $12
       f32.const 255
       f32.gt
       br_if $assembly/math/clamp255|inlined.33
       drop
       local.get $12
       i32.trunc_sat_f32_u
      end
      i32.store8 offset=1
      local.get $0
      local.get $7
      i32.add
      block $assembly/math/clamp255|inlined.34 (result i32)
       i32.const 0
       local.get $11
       f32.const 0.2720000147819519
       f32.mul
       local.get $5
       f32.const 0.5339999794960022
       f32.mul
       f32.add
       local.get $8
       f32.const 0.13099999725818634
       f32.mul
       f32.add
       local.tee $5
       local.get $5
       f32.ne
       br_if $assembly/math/clamp255|inlined.34
       drop
       i32.const 0
       local.get $5
       f32.const 0
       f32.lt
       br_if $assembly/math/clamp255|inlined.34
       drop
       i32.const 255
       local.get $5
       f32.const 255
       f32.gt
       br_if $assembly/math/clamp255|inlined.34
       drop
       local.get $5
       i32.trunc_sat_f32_u
      end
      i32.store8 offset=2
      local.get $6
      i32.const 1
      i32.add
      local.set $6
      br $for-loop|1
     end
    end
    local.get $3
    i32.const 1
    i32.add
    local.set $3
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/exposure (param $0 i32) (param $1 i32) (param $2 i32) (param $3 f32) (param $4 f32) (param $5 i32) (param $6 i32)
  (local $7 i32)
  (local $8 f64)
  (local $9 i32)
  (local $10 i32)
  (local $11 i32)
  (local $12 i32)
  local.get $4
  f32.const 0.05000000074505806
  f32.gt
  if (result f64)
   f64.const 1
   local.get $4
   f64.promote_f32
   f64.div
  else
   f64.const 1
  end
  local.set $8
  loop $for-loop|0
   local.get $5
   local.get $6
   i32.lt_s
   if
    local.get $1
    local.get $5
    i32.mul
    i32.const 2
    i32.shl
    local.set $9
    i32.const 0
    local.set $2
    loop $for-loop|1
     local.get $1
     local.get $2
     i32.gt_s
     if
      local.get $9
      local.get $2
      i32.const 2
      i32.shl
      i32.add
      local.set $10
      i32.const 0
      local.set $7
      loop $for-loop|2
       local.get $7
       i32.const 3
       i32.lt_u
       if
        block $assembly/math/clamp255|inlined.35 (result i32)
         i32.const 0
         local.get $0
         local.get $10
         i32.add
         local.get $7
         i32.add
         local.tee $11
         i32.load8_u
         f32.convert_i32_u
         local.get $3
         f32.mul
         f64.promote_f32
         f64.const 255
         f64.div
         local.get $8
         call $~lib/math/NativeMath.pow
         f64.const 255
         f64.mul
         f32.demote_f64
         local.tee $4
         local.get $4
         f32.ne
         br_if $assembly/math/clamp255|inlined.35
         drop
         i32.const 0
         local.get $4
         f32.const 0
         f32.lt
         br_if $assembly/math/clamp255|inlined.35
         drop
         i32.const 255
         local.get $4
         f32.const 255
         f32.gt
         br_if $assembly/math/clamp255|inlined.35
         drop
         local.get $4
         i32.trunc_sat_f32_u
        end
        local.set $12
        local.get $11
        local.get $12
        i32.store8
        local.get $7
        i32.const 1
        i32.add
        local.set $7
        br $for-loop|2
       end
      end
      local.get $2
      i32.const 1
      i32.add
      local.set $2
      br $for-loop|1
     end
    end
    local.get $5
    i32.const 1
    i32.add
    local.set $5
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/halftone (param $0 i32) (param $1 i32) (param $2 i32) (param $3 f32) (param $4 i32) (param $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 f32)
  (local $10 f32)
  (local $11 f32)
  (local $12 f32)
  f64.const 6.283185307179586
  local.get $3
  f64.promote_f32
  f64.div
  f32.demote_f64
  local.set $11
  f64.const 0.7853981852531433
  call $~lib/math/NativeMath.cos
  f32.demote_f64
  local.set $12
  f64.const 0.7853981852531433
  call $~lib/math/NativeMath.sin
  f32.demote_f64
  local.set $3
  loop $for-loop|0
   local.get $4
   local.get $5
   i32.lt_s
   if
    local.get $1
    local.get $4
    i32.mul
    i32.const 2
    i32.shl
    local.set $8
    i32.const 0
    local.set $2
    loop $for-loop|1
     local.get $1
     local.get $2
     i32.gt_s
     if
      i32.const 255
      i32.const 0
      local.get $8
      local.get $2
      i32.const 2
      i32.shl
      i32.add
      local.get $0
      i32.add
      local.tee $6
      i32.load8_u
      f32.convert_i32_u
      f64.promote_f32
      f64.const 0.299
      f64.mul
      local.get $6
      i32.load8_u offset=1
      f32.convert_i32_u
      f64.promote_f32
      f64.const 0.587
      f64.mul
      f64.add
      local.get $6
      i32.load8_u offset=2
      f32.convert_i32_u
      f64.promote_f32
      f64.const 0.114
      f64.mul
      f64.add
      f64.const 255
      f64.div
      local.get $2
      f32.convert_i32_s
      local.tee $9
      local.get $12
      f32.mul
      local.get $4
      f32.convert_i32_s
      local.tee $10
      local.get $3
      f32.mul
      f32.sub
      local.get $11
      f32.mul
      f64.promote_f32
      call $~lib/math/NativeMath.sin
      local.get $9
      local.get $3
      f32.mul
      local.get $10
      local.get $12
      f32.mul
      f32.add
      local.get $11
      f32.mul
      f64.promote_f32
      call $~lib/math/NativeMath.sin
      f64.add
      f64.const 0.5
      f64.mul
      f32.demote_f64
      f32.const 1
      f32.add
      f32.const 0.5
      f32.mul
      f64.promote_f32
      f64.ge
      select
      local.set $7
      local.get $6
      local.get $7
      i32.store8
      local.get $6
      local.get $7
      i32.store8 offset=1
      local.get $6
      local.get $7
      i32.store8 offset=2
      local.get $2
      i32.const 1
      i32.add
      local.set $2
      br $for-loop|1
     end
    end
    local.get $4
    i32.const 1
    i32.add
    local.set $4
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/edgeDetect (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 f32) (param $5 i32) (param $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  (local $10 i32)
  (local $11 i32)
  (local $12 i32)
  (local $13 i32)
  (local $14 f32)
  (local $15 f32)
  (local $16 f32)
  (local $17 f32)
  (local $18 f32)
  (local $19 f32)
  (local $20 f32)
  (local $21 f32)
  (local $22 i32)
  (local $23 i32)
  (local $24 i32)
  (local $25 i32)
  (local $26 f32)
  loop $for-loop|0
   local.get $5
   local.get $6
   i32.lt_s
   if
    local.get $2
    local.get $5
    i32.mul
    i32.const 2
    i32.shl
    local.set $9
    i32.const 0
    local.set $7
    loop $for-loop|1
     local.get $2
     local.get $7
     i32.gt_s
     if
      block $for-continue|1
       local.get $5
       i32.eqz
       local.get $7
       i32.eqz
       local.get $7
       local.get $2
       i32.const 1
       i32.sub
       i32.eq
       i32.or
       i32.or
       local.get $5
       local.get $3
       i32.const 1
       i32.sub
       i32.eq
       i32.or
       if
        local.get $1
        local.get $9
        i32.add
        local.get $7
        i32.const 2
        i32.shl
        i32.add
        i32.const 0
        i32.store
        br $for-continue|1
       end
       local.get $9
       local.get $7
       i32.const 2
       i32.shl
       i32.add
       local.tee $10
       local.get $1
       i32.add
       local.tee $8
       block $assembly/math/clamp255|inlined.36 (result i32)
        i32.const 0
        local.get $0
        local.get $7
        i32.const 1
        i32.sub
        local.tee $12
        local.get $5
        i32.const 1
        i32.sub
        local.get $2
        i32.mul
        local.tee $22
        i32.add
        i32.const 2
        i32.shl
        i32.add
        local.tee $11
        i32.load8_u
        f32.convert_i32_u
        f32.const 0.29899999499320984
        f32.mul
        local.get $11
        i32.load8_u offset=1
        f32.convert_i32_u
        f32.const 0.5870000123977661
        f32.mul
        local.tee $14
        f32.add
        local.get $11
        i32.load8_u offset=2
        f32.convert_i32_u
        f32.const 0.11400000005960464
        f32.mul
        local.tee $15
        f32.add
        local.get $0
        local.get $2
        local.get $5
        i32.mul
        local.tee $23
        local.get $12
        i32.add
        i32.const 2
        i32.shl
        i32.add
        local.tee $13
        i32.load8_u
        f32.convert_i32_u
        f32.const 0.29899999499320984
        f32.mul
        local.get $13
        i32.load8_u offset=1
        f32.convert_i32_u
        f32.const 0.5870000123977661
        f32.mul
        f32.add
        local.get $13
        i32.load8_u offset=2
        f32.convert_i32_u
        f32.const 0.11400000005960464
        f32.mul
        f32.add
        f32.const 2
        f32.mul
        f32.add
        local.get $0
        local.get $5
        i32.const 1
        i32.add
        local.get $2
        i32.mul
        local.tee $24
        local.get $12
        i32.add
        i32.const 2
        i32.shl
        i32.add
        local.tee $25
        i32.load8_u
        f32.convert_i32_u
        f32.const 0.29899999499320984
        f32.mul
        local.get $25
        i32.load8_u offset=1
        f32.convert_i32_u
        f32.const 0.5870000123977661
        f32.mul
        local.tee $16
        f32.add
        local.get $25
        i32.load8_u offset=2
        f32.convert_i32_u
        f32.const 0.11400000005960464
        f32.mul
        local.tee $17
        f32.add
        f32.add
        local.get $0
        local.get $22
        local.get $7
        i32.const 1
        i32.add
        local.tee $12
        i32.add
        i32.const 2
        i32.shl
        i32.add
        local.tee $13
        i32.load8_u
        f32.convert_i32_u
        f32.const 0.29899999499320984
        f32.mul
        local.get $13
        i32.load8_u offset=1
        f32.convert_i32_u
        f32.const 0.5870000123977661
        f32.mul
        local.tee $18
        f32.add
        local.get $13
        i32.load8_u offset=2
        f32.convert_i32_u
        f32.const 0.11400000005960464
        f32.mul
        local.tee $19
        f32.add
        local.get $0
        local.get $12
        local.get $23
        i32.add
        i32.const 2
        i32.shl
        i32.add
        local.tee $23
        i32.load8_u
        f32.convert_i32_u
        f32.const 0.29899999499320984
        f32.mul
        local.get $23
        i32.load8_u offset=1
        f32.convert_i32_u
        f32.const 0.5870000123977661
        f32.mul
        f32.add
        local.get $23
        i32.load8_u offset=2
        f32.convert_i32_u
        f32.const 0.11400000005960464
        f32.mul
        f32.add
        f32.const 2
        f32.mul
        f32.add
        local.get $0
        local.get $12
        local.get $24
        i32.add
        i32.const 2
        i32.shl
        i32.add
        local.tee $12
        i32.load8_u
        f32.convert_i32_u
        f32.const 0.29899999499320984
        f32.mul
        local.get $12
        i32.load8_u offset=1
        f32.convert_i32_u
        f32.const 0.5870000123977661
        f32.mul
        local.tee $20
        f32.add
        local.get $12
        i32.load8_u offset=2
        f32.convert_i32_u
        f32.const 0.11400000005960464
        f32.mul
        local.tee $21
        f32.add
        f32.add
        f32.sub
        local.tee $26
        local.get $26
        f32.mul
        local.get $11
        i32.load8_u
        f32.convert_i32_u
        f32.const 0.29899999499320984
        f32.mul
        local.get $14
        f32.add
        local.get $15
        f32.add
        local.get $0
        local.get $7
        local.get $22
        i32.add
        i32.const 2
        i32.shl
        i32.add
        local.tee $11
        i32.load8_u
        f32.convert_i32_u
        f32.const 0.29899999499320984
        f32.mul
        local.get $11
        i32.load8_u offset=1
        f32.convert_i32_u
        f32.const 0.5870000123977661
        f32.mul
        f32.add
        local.get $11
        i32.load8_u offset=2
        f32.convert_i32_u
        f32.const 0.11400000005960464
        f32.mul
        f32.add
        f32.const 2
        f32.mul
        f32.add
        local.get $13
        i32.load8_u
        f32.convert_i32_u
        f32.const 0.29899999499320984
        f32.mul
        local.get $18
        f32.add
        local.get $19
        f32.add
        f32.add
        local.get $25
        i32.load8_u
        f32.convert_i32_u
        f32.const 0.29899999499320984
        f32.mul
        local.get $16
        f32.add
        local.get $17
        f32.add
        local.get $0
        local.get $7
        local.get $24
        i32.add
        i32.const 2
        i32.shl
        i32.add
        local.tee $11
        i32.load8_u
        f32.convert_i32_u
        f32.const 0.29899999499320984
        f32.mul
        local.get $11
        i32.load8_u offset=1
        f32.convert_i32_u
        f32.const 0.5870000123977661
        f32.mul
        f32.add
        local.get $11
        i32.load8_u offset=2
        f32.convert_i32_u
        f32.const 0.11400000005960464
        f32.mul
        f32.add
        f32.const 2
        f32.mul
        f32.add
        local.get $12
        i32.load8_u
        f32.convert_i32_u
        f32.const 0.29899999499320984
        f32.mul
        local.get $20
        f32.add
        local.get $21
        f32.add
        f32.add
        f32.sub
        local.tee $14
        local.get $14
        f32.mul
        f32.add
        f64.promote_f32
        f64.sqrt
        f32.demote_f64
        local.get $4
        f32.mul
        f32.const 4
        f32.mul
        local.tee $14
        local.get $14
        f32.ne
        br_if $assembly/math/clamp255|inlined.36
        drop
        i32.const 0
        local.get $14
        f32.const 0
        f32.lt
        br_if $assembly/math/clamp255|inlined.36
        drop
        i32.const 255
        local.get $14
        f32.const 255
        f32.gt
        br_if $assembly/math/clamp255|inlined.36
        drop
        local.get $14
        i32.trunc_sat_f32_u
       end
       local.tee $11
       i32.store8
       local.get $8
       local.get $11
       i32.store8 offset=1
       local.get $8
       local.get $11
       i32.store8 offset=2
       local.get $8
       local.get $0
       local.get $10
       i32.add
       i32.load8_u offset=3
       i32.store8 offset=3
      end
      local.get $7
      i32.const 1
      i32.add
      local.set $7
      br $for-loop|1
     end
    end
    local.get $5
    i32.const 1
    i32.add
    local.set $5
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/scanlines (param $0 i32) (param $1 i32) (param $2 i32) (param $3 f32) (param $4 f32) (param $5 i32) (param $6 i32)
  (local $7 i32)
  (local $8 f32)
  (local $9 i32)
  (local $10 i32)
  (local $11 f32)
  (local $12 i32)
  loop $for-loop|0
   local.get $5
   local.get $6
   i32.lt_s
   if
    local.get $1
    local.get $5
    i32.mul
    i32.const 2
    i32.shl
    local.set $7
    f32.const 1
    local.get $5
    f64.convert_i32_s
    local.get $3
    f64.promote_f32
    f64.mul
    call $~lib/math/NativeMath.sin
    f32.demote_f64
    local.tee $8
    f32.neg
    local.get $8
    local.get $8
    f32.const 0
    f32.lt
    select
    local.get $4
    f32.mul
    f32.sub
    local.set $8
    i32.const 0
    local.set $2
    loop $for-loop|1
     local.get $1
     local.get $2
     i32.gt_s
     if
      block $assembly/math/clamp255|inlined.37 (result i32)
       i32.const 0
       local.get $7
       local.get $2
       i32.const 2
       i32.shl
       i32.add
       local.tee $9
       local.get $0
       i32.add
       local.tee $10
       i32.load8_u
       f32.convert_i32_u
       local.get $8
       f32.mul
       local.tee $11
       local.get $11
       f32.ne
       br_if $assembly/math/clamp255|inlined.37
       drop
       i32.const 0
       local.get $11
       f32.const 0
       f32.lt
       br_if $assembly/math/clamp255|inlined.37
       drop
       i32.const 255
       local.get $11
       f32.const 255
       f32.gt
       br_if $assembly/math/clamp255|inlined.37
       drop
       local.get $11
       i32.trunc_sat_f32_u
      end
      local.set $12
      local.get $10
      local.get $12
      i32.store8
      block $assembly/math/clamp255|inlined.38 (result i32)
       i32.const 0
       local.get $0
       local.get $9
       i32.add
       local.tee $10
       i32.const 1
       i32.add
       i32.load8_u
       f32.convert_i32_u
       local.get $8
       f32.mul
       local.tee $11
       local.get $11
       f32.ne
       br_if $assembly/math/clamp255|inlined.38
       drop
       i32.const 0
       local.get $11
       f32.const 0
       f32.lt
       br_if $assembly/math/clamp255|inlined.38
       drop
       i32.const 255
       local.get $11
       f32.const 255
       f32.gt
       br_if $assembly/math/clamp255|inlined.38
       drop
       local.get $11
       i32.trunc_sat_f32_u
      end
      local.set $12
      local.get $10
      local.get $12
      i32.store8 offset=1
      block $assembly/math/clamp255|inlined.39 (result i32)
       i32.const 0
       local.get $0
       local.get $9
       i32.add
       local.tee $9
       i32.const 2
       i32.add
       i32.load8_u
       f32.convert_i32_u
       local.get $8
       f32.mul
       local.tee $11
       local.get $11
       f32.ne
       br_if $assembly/math/clamp255|inlined.39
       drop
       i32.const 0
       local.get $11
       f32.const 0
       f32.lt
       br_if $assembly/math/clamp255|inlined.39
       drop
       i32.const 255
       local.get $11
       f32.const 255
       f32.gt
       br_if $assembly/math/clamp255|inlined.39
       drop
       local.get $11
       i32.trunc_sat_f32_u
      end
      local.set $10
      local.get $9
      local.get $10
      i32.store8 offset=2
      local.get $2
      i32.const 1
      i32.add
      local.set $2
      br $for-loop|1
     end
    end
    local.get $5
    i32.const 1
    i32.add
    local.set $5
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/blendMask (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32)
  (local $8 f32)
  (local $9 f32)
  (local $10 i32)
  (local $11 i32)
  (local $12 i32)
  (local $13 i32)
  loop $for-loop|0
   local.get $6
   local.get $7
   i32.lt_s
   if
    local.get $4
    local.get $6
    i32.mul
    i32.const 2
    i32.shl
    local.set $12
    i32.const 0
    local.set $5
    loop $for-loop|1
     local.get $4
     local.get $5
     i32.gt_s
     if
      f32.const 1
      local.get $12
      local.get $5
      i32.const 2
      i32.shl
      i32.add
      local.tee $13
      local.get $2
      i32.add
      i32.load8_u offset=3
      f32.convert_i32_u
      f32.const 0.003921568859368563
      f32.mul
      local.tee $8
      f32.sub
      local.set $9
      local.get $3
      local.get $13
      i32.add
      local.tee $10
      local.get $0
      local.get $13
      i32.add
      local.tee $11
      i32.load8_u
      f32.convert_i32_u
      local.get $9
      f32.mul
      local.get $1
      local.get $13
      i32.add
      local.tee $13
      i32.load8_u
      f32.convert_i32_u
      local.get $8
      f32.mul
      f32.add
      f32.const 0.5
      f32.add
      i32.trunc_sat_f32_u
      i32.store8
      local.get $10
      local.get $11
      i32.load8_u offset=1
      f32.convert_i32_u
      local.get $9
      f32.mul
      local.get $13
      i32.load8_u offset=1
      f32.convert_i32_u
      local.get $8
      f32.mul
      f32.add
      f32.const 0.5
      f32.add
      i32.trunc_sat_f32_u
      i32.store8 offset=1
      local.get $10
      local.get $11
      i32.load8_u offset=2
      f32.convert_i32_u
      local.get $9
      f32.mul
      local.get $13
      i32.load8_u offset=2
      f32.convert_i32_u
      local.get $8
      f32.mul
      f32.add
      f32.const 0.5
      f32.add
      i32.trunc_sat_f32_u
      i32.store8 offset=2
      local.get $10
      local.get $11
      i32.load8_u offset=3
      i32.store8 offset=3
      local.get $5
      i32.const 1
      i32.add
      local.set $5
      br $for-loop|1
     end
    end
    local.get $6
    i32.const 1
    i32.add
    local.set $6
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/buildDynamicMask (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32) (param $8 f32)
  (local $9 i32)
  (local $10 f32)
  (local $11 i32)
  (local $12 i32)
  (local $13 i32)
  (local $14 i32)
  (local $15 i32)
  loop $for-loop|0
   local.get $7
   local.get $11
   i32.gt_s
   if
    local.get $6
    local.get $11
    i32.mul
    i32.const 2
    i32.shl
    local.set $13
    local.get $11
    local.get $5
    i32.sub
    local.set $12
    i32.const 0
    local.set $9
    loop $for-loop|1
     local.get $6
     local.get $9
     i32.gt_s
     if
      local.get $13
      local.get $9
      i32.const 2
      i32.shl
      i32.add
      local.set $14
      block $for-continue|1
       local.get $9
       local.get $4
       i32.sub
       local.tee $15
       local.get $12
       i32.or
       i32.const 0
       i32.lt_s
       local.get $2
       local.get $15
       i32.le_s
       i32.or
       local.get $3
       local.get $12
       i32.le_s
       i32.or
       if
        local.get $1
        local.get $14
        i32.add
        i32.const 0
        i32.store
        br $for-continue|1
       end
       block $assembly/math/clamp255|inlined.40 (result i32)
        i32.const 0
        local.get $0
        local.get $2
        local.get $12
        i32.mul
        local.get $15
        i32.add
        i32.const 2
        i32.shl
        i32.add
        local.tee $15
        i32.load8_u
        f32.convert_i32_u
        f64.promote_f32
        f64.const 0.299
        f64.mul
        local.get $15
        i32.load8_u offset=1
        f32.convert_i32_u
        f64.promote_f32
        f64.const 0.587
        f64.mul
        f64.add
        local.get $15
        i32.load8_u offset=2
        f32.convert_i32_u
        f64.promote_f32
        f64.const 0.114
        f64.mul
        f64.add
        f64.const 255
        f64.div
        local.get $15
        i32.load8_u offset=3
        f32.convert_i32_u
        f32.const 255
        f32.div
        f64.promote_f32
        f64.mul
        local.get $8
        f64.promote_f32
        f64.mul
        f64.const 255
        f64.mul
        f32.demote_f64
        local.tee $10
        local.get $10
        f32.ne
        br_if $assembly/math/clamp255|inlined.40
        drop
        i32.const 0
        local.get $10
        f32.const 0
        f32.lt
        br_if $assembly/math/clamp255|inlined.40
        drop
        i32.const 255
        local.get $10
        f32.const 255
        f32.gt
        br_if $assembly/math/clamp255|inlined.40
        drop
        local.get $10
        i32.trunc_sat_f32_u
       end
       local.set $15
       local.get $1
       local.get $14
       i32.add
       local.tee $14
       i32.const 0
       i32.store8
       local.get $14
       i32.const 0
       i32.store8 offset=1
       local.get $14
       i32.const 0
       i32.store8 offset=2
       local.get $14
       local.get $15
       i32.store8 offset=3
      end
      local.get $9
      i32.const 1
      i32.add
      local.set $9
      br $for-loop|1
     end
    end
    local.get $11
    i32.const 1
    i32.add
    local.set $11
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/applyLuminanceMask (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32) (param $8 i32) (param $9 i32) (param $10 i32)
  (local $11 f32)
  (local $12 i32)
  (local $13 i32)
  (local $14 i32)
  (local $15 i32)
  (local $16 i32)
  (local $17 i32)
  (local $18 i32)
  loop $for-loop|0
   local.get $10
   local.get $14
   i32.gt_s
   if
    local.get $9
    local.get $14
    i32.mul
    i32.const 2
    i32.shl
    local.set $15
    local.get $14
    local.get $6
    i32.sub
    local.set $12
    i32.const 0
    local.set $13
    loop $for-loop|1
     local.get $9
     local.get $13
     i32.gt_s
     if
      local.get $15
      local.get $13
      i32.const 2
      i32.shl
      i32.add
      local.set $16
      block $for-continue|1
       local.get $13
       local.get $5
       i32.sub
       local.tee $17
       local.get $12
       i32.or
       i32.const 0
       i32.lt_s
       local.get $3
       local.get $17
       i32.le_s
       i32.or
       local.get $4
       local.get $12
       i32.le_s
       i32.or
       if
        local.get $2
        local.get $16
        i32.add
        i32.const 0
        i32.store
        br $for-continue|1
       end
       local.get $3
       local.get $12
       i32.mul
       local.get $17
       i32.add
       i32.const 2
       i32.shl
       local.tee $18
       local.get $0
       i32.add
       i32.load8_u offset=3
       f32.convert_i32_u
       local.set $11
       local.get $8
       local.get $12
       i32.gt_s
       local.get $7
       local.get $17
       i32.gt_s
       i32.and
       if
        local.get $11
        local.get $1
        local.get $7
        local.get $12
        i32.mul
        local.get $17
        i32.add
        i32.const 2
        i32.shl
        i32.add
        local.tee $17
        i32.load8_u
        f32.convert_i32_u
        f64.promote_f32
        f64.const 0.299
        f64.mul
        local.get $17
        i32.load8_u offset=1
        f32.convert_i32_u
        f64.promote_f32
        f64.const 0.587
        f64.mul
        f64.add
        local.get $17
        i32.load8_u offset=2
        f32.convert_i32_u
        f64.promote_f32
        f64.const 0.114
        f64.mul
        f64.add
        f64.const 255
        f64.div
        local.get $17
        i32.load8_u offset=3
        f32.convert_i32_u
        f32.const 255
        f32.div
        f64.promote_f32
        f64.mul
        f32.demote_f64
        f32.mul
        local.set $11
       end
       local.get $2
       local.get $16
       i32.add
       local.tee $16
       local.get $0
       local.get $18
       i32.add
       local.tee $17
       i32.load8_u
       i32.store8
       local.get $16
       local.get $17
       i32.load8_u offset=1
       i32.store8 offset=1
       local.get $16
       local.get $17
       i32.load8_u offset=2
       i32.store8 offset=2
       local.get $16
       local.get $11
       f32.const 0.5
       f32.add
       i32.trunc_sat_f32_u
       i32.store8 offset=3
      end
      local.get $13
      i32.const 1
      i32.add
      local.set $13
      br $for-loop|1
     end
    end
    local.get $14
    i32.const 1
    i32.add
    local.set $14
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/similarColor (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32) (param $8 f32)
  (local $9 i32)
  (local $10 i32)
  (local $11 f32)
  local.get $8
  local.get $8
  f32.mul
  local.set $8
  loop $for-loop|0
   local.get $9
   local.get $2
   local.get $3
   i32.mul
   i32.lt_s
   if
    local.get $0
    local.get $9
    i32.const 2
    i32.shl
    i32.add
    local.tee $10
    i32.load8_u
    f32.convert_i32_u
    local.get $4
    i32.const 255
    i32.and
    f32.convert_i32_u
    f32.sub
    local.tee $11
    local.get $11
    f32.mul
    local.get $10
    i32.load8_u offset=1
    f32.convert_i32_u
    local.get $5
    i32.const 255
    i32.and
    f32.convert_i32_u
    f32.sub
    local.tee $11
    local.get $11
    f32.mul
    f32.add
    local.get $10
    i32.load8_u offset=2
    f32.convert_i32_u
    local.get $6
    i32.const 255
    i32.and
    f32.convert_i32_u
    f32.sub
    local.tee $11
    local.get $11
    f32.mul
    f32.add
    local.get $10
    i32.load8_u offset=3
    f32.convert_i32_u
    local.get $7
    i32.const 255
    i32.and
    f32.convert_i32_u
    f32.sub
    local.tee $11
    local.get $11
    f32.mul
    f32.add
    local.get $8
    f32.le
    if
     local.get $1
     local.get $9
     i32.add
     i32.const 1
     i32.store8
    else
     local.get $1
     local.get $9
     i32.add
     i32.const 0
     i32.store8
    end
    local.get $9
    i32.const 1
    i32.add
    local.set $9
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/colorMatch (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32) (param $8 f32) (param $9 f32)
  (local $10 i32)
  (local $11 i32)
  (local $12 f32)
  (local $13 f32)
  (local $14 f32)
  local.get $8
  local.get $8
  f32.mul
  local.set $12
  loop $for-loop|0
   local.get $10
   local.get $2
   local.get $3
   i32.mul
   i32.lt_s
   if
    local.get $0
    local.get $10
    i32.const 2
    i32.shl
    i32.add
    local.tee $11
    i32.load8_u
    f32.convert_i32_u
    local.get $4
    i32.const 255
    i32.and
    f32.convert_i32_u
    f32.sub
    local.set $13
    local.get $11
    i32.load8_u offset=1
    f32.convert_i32_u
    local.get $5
    i32.const 255
    i32.and
    f32.convert_i32_u
    f32.sub
    local.set $14
    local.get $11
    i32.load8_u offset=2
    f32.convert_i32_u
    local.get $6
    i32.const 255
    i32.and
    f32.convert_i32_u
    f32.sub
    local.set $8
    local.get $11
    i32.load8_u offset=3
    f64.convert_i32_u
    local.get $7
    i32.const 255
    i32.and
    f64.convert_i32_u
    f64.sub
    f64.abs
    f32.demote_f64
    local.get $9
    f32.le
    if (result i32)
     local.get $13
     local.get $13
     f32.mul
     local.get $14
     local.get $14
     f32.mul
     f32.add
     local.get $8
     local.get $8
     f32.mul
     f32.add
     local.get $12
     f32.le
    else
     i32.const 0
    end
    if
     local.get $1
     local.get $10
     i32.add
     i32.const 1
     i32.store8
    else
     local.get $1
     local.get $10
     i32.add
     i32.const 0
     i32.store8
    end
    local.get $10
    i32.const 1
    i32.add
    local.set $10
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/grayscaleAlpha (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  loop $for-loop|0
   local.get $4
   local.get $2
   local.get $3
   i32.mul
   i32.lt_u
   if
    local.get $4
    i32.const 2
    i32.shl
    local.tee $6
    local.get $0
    i32.add
    i32.load8_u offset=3
    local.set $5
    local.get $1
    local.get $6
    i32.add
    local.tee $6
    local.get $5
    i32.store8
    local.get $6
    local.get $5
    i32.store8 offset=1
    local.get $6
    local.get $5
    i32.store8 offset=2
    local.get $6
    i32.const 255
    i32.store8 offset=3
    local.get $4
    i32.const 1
    i32.add
    local.set $4
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/getMaskOutlineSegments (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32) (param $8 i32) (param $9 i32) (result i32)
  (local $10 i32)
  (local $11 i32)
  (local $12 i32)
  (local $13 i32)
  (local $14 i32)
  local.get $4
  local.set $12
  loop $for-loop|0
   local.get $6
   local.get $12
   i32.gt_s
   if
    local.get $1
    local.get $12
    i32.mul
    local.set $13
    local.get $3
    local.set $11
    loop $for-loop|1
     local.get $5
     local.get $11
     i32.ge_s
     if
      local.get $1
      local.get $11
      i32.gt_s
      if (result i32)
       local.get $0
       local.get $13
       i32.add
       local.get $11
       i32.add
       i32.load8_u
      else
       i32.const 0
      end
      local.set $14
      local.get $7
      local.get $11
      i32.le_s
      if (result i32)
       local.get $0
       local.get $13
       i32.add
       local.get $11
       local.get $7
       i32.sub
       i32.add
       i32.load8_u
      else
       i32.const 0
      end
      local.get $14
      i32.ne
      if
       local.get $9
       local.get $10
       i32.le_s
       if
        local.get $10
        return
       end
       local.get $8
       local.get $10
       i32.const 4
       i32.shl
       i32.add
       local.tee $14
       local.get $11
       f32.convert_i32_s
       f32.store
       local.get $14
       local.get $12
       f32.convert_i32_s
       f32.store offset=4
       local.get $14
       f32.const 0
       f32.store offset=8
       local.get $14
       local.get $7
       f32.convert_i32_s
       f32.store offset=12
       local.get $10
       i32.const 1
       i32.add
       local.set $10
      end
      local.get $7
      local.get $11
      i32.add
      local.set $11
      br $for-loop|1
     end
    end
    local.get $7
    local.get $12
    i32.add
    local.set $12
    br $for-loop|0
   end
  end
  loop $for-loop|2
   local.get $4
   local.get $6
   i32.le_s
   if
    i32.const -1
    local.get $1
    local.get $4
    i32.mul
    local.get $2
    local.get $4
    i32.le_s
    select
    local.set $12
    i32.const -1
    local.get $4
    local.get $7
    i32.sub
    local.get $1
    i32.mul
    local.get $4
    local.get $7
    i32.lt_s
    select
    local.set $13
    local.get $3
    local.set $11
    loop $for-loop|3
     local.get $5
     local.get $11
     i32.gt_s
     if
      local.get $12
      i32.const -1
      i32.ne
      if (result i32)
       local.get $0
       local.get $12
       i32.add
       local.get $11
       i32.add
       i32.load8_u
      else
       i32.const 0
      end
      local.set $14
      local.get $13
      i32.const -1
      i32.ne
      if (result i32)
       local.get $0
       local.get $13
       i32.add
       local.get $11
       i32.add
       i32.load8_u
      else
       i32.const 0
      end
      local.get $14
      i32.ne
      if
       local.get $9
       local.get $10
       i32.le_s
       if
        local.get $10
        return
       end
       local.get $8
       local.get $10
       i32.const 4
       i32.shl
       i32.add
       local.tee $14
       local.get $11
       f32.convert_i32_s
       f32.store
       local.get $14
       local.get $4
       f32.convert_i32_s
       f32.store offset=4
       local.get $14
       local.get $7
       f32.convert_i32_s
       f32.store offset=8
       local.get $14
       f32.const 0
       f32.store offset=12
       local.get $10
       i32.const 1
       i32.add
       local.set $10
      end
      local.get $7
      local.get $11
      i32.add
      local.set $11
      br $for-loop|3
     end
    end
    local.get $4
    local.get $7
    i32.add
    local.set $4
    br $for-loop|2
   end
  end
  local.get $10
 )
 (func $assembly/vector/pointDistance (param $0 f32) (param $1 f32) (param $2 f32) (param $3 f32) (result f32)
  local.get $0
  local.get $2
  f32.sub
  local.tee $0
  local.get $0
  f32.mul
  local.get $1
  local.get $3
  f32.sub
  local.tee $0
  local.get $0
  f32.mul
  f32.add
  f32.sqrt
 )
 (func $assembly/vector/perpendicularDistance (param $0 f32) (param $1 f32) (param $2 f32) (param $3 f32) (param $4 f32) (param $5 f32) (result f32)
  (local $6 f32)
  local.get $4
  local.get $2
  f32.sub
  local.tee $4
  local.get $4
  f32.mul
  local.get $5
  local.get $3
  f32.sub
  local.tee $5
  local.get $5
  f32.mul
  f32.add
  f32.sqrt
  local.tee $6
  f32.const 0
  f32.gt
  if
   local.get $5
   local.get $6
   f32.div
   local.set $5
   local.get $4
   local.get $6
   f32.div
   local.set $4
  end
  local.get $4
  local.get $0
  local.get $2
  f32.sub
  local.tee $0
  f32.mul
  local.get $5
  local.get $1
  local.get $3
  f32.sub
  local.tee $1
  f32.mul
  f32.add
  local.set $2
  local.get $0
  local.get $2
  local.get $4
  f32.mul
  f32.sub
  local.tee $0
  local.get $0
  f32.mul
  local.get $1
  local.get $2
  local.get $5
  f32.mul
  f32.sub
  local.tee $0
  local.get $0
  f32.mul
  f32.add
  f32.sqrt
 )
 (func $assembly/vector/isPointOnSegment (param $0 f32) (param $1 f32) (param $2 f32) (param $3 f32) (param $4 f32) (param $5 f32) (param $6 f32) (result i32)
  (local $7 f32)
  (local $8 f32)
  (local $9 f32)
  (local $10 f32)
  (local $11 f32)
  local.get $4
  local.get $2
  f32.sub
  local.tee $7
  local.get $7
  f32.mul
  local.get $5
  local.get $3
  f32.sub
  local.tee $8
  local.get $8
  f32.mul
  f32.add
  f32.sqrt
  local.tee $9
  f32.const 0
  f32.gt
  if
   local.get $8
   local.get $9
   f32.div
   local.set $8
   local.get $7
   local.get $9
   f32.div
   local.set $7
  end
  local.get $7
  local.get $0
  local.get $2
  f32.sub
  local.tee $10
  f32.mul
  local.get $8
  local.get $1
  local.get $3
  f32.sub
  local.tee $9
  f32.mul
  f32.add
  local.set $11
  local.get $6
  local.get $10
  local.get $11
  local.get $7
  f32.mul
  f32.sub
  local.tee $7
  local.get $7
  f32.mul
  local.get $9
  local.get $11
  local.get $8
  f32.mul
  f32.sub
  local.tee $7
  local.get $7
  f32.mul
  f32.add
  f32.sqrt
  f32.lt
  if
   i32.const 0
   return
  end
  local.get $0
  local.get $2
  local.get $4
  f32.max
  local.get $6
  f32.add
  f32.le
  local.get $0
  local.get $2
  local.get $4
  f32.min
  local.get $6
  f32.sub
  f32.ge
  i32.and
  local.get $1
  local.get $3
  local.get $5
  f32.min
  local.get $6
  f32.sub
  f32.ge
  i32.and
  local.get $1
  local.get $3
  local.get $5
  f32.max
  local.get $6
  f32.add
  f32.le
  i32.and
 )
 (func $assembly/vector/getCubicBezierPoint (param $0 f32) (param $1 f32) (param $2 f32) (param $3 f32) (param $4 f32) (param $5 f32) (param $6 f32) (param $7 f32) (param $8 f32) (result f32)
  f32.const 1
  local.get $0
  f32.sub
  local.tee $2
  f32.const 3
  f32.mul
  local.set $4
  local.get $2
  local.get $2
  f32.mul
  local.get $2
  f32.mul
  local.get $1
  f32.mul
  local.get $4
  local.get $2
  f32.mul
  local.get $0
  f32.mul
  local.get $3
  f32.mul
  f32.add
  local.get $4
  local.get $0
  f32.mul
  local.get $0
  f32.mul
  local.get $5
  f32.mul
  f32.add
  local.get $0
  local.get $0
  f32.mul
  local.get $0
  f32.mul
  local.get $7
  f32.mul
  f32.add
 )
 (func $assembly/pdn_effects/relief (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 f32) (param $5 i32) (param $6 i32)
  (local $7 f64)
  (local $8 f64)
  (local $9 f64)
  (local $10 i32)
  (local $11 i32)
  (local $12 i32)
  (local $13 f64)
  (local $14 f64)
  (local $15 f64)
  (local $16 f64)
  (local $17 f64)
  (local $18 f64)
  (local $19 f64)
  (local $20 f64)
  (local $21 f64)
  (local $22 i32)
  (local $23 i32)
  (local $24 i32)
  local.get $4
  f64.promote_f32
  local.tee $7
  f64.const 0.7853981633974483
  f64.add
  call $~lib/math/NativeMath.cos
  local.set $8
  local.get $7
  f64.const 1.5707963267948966
  f64.add
  call $~lib/math/NativeMath.cos
  local.set $15
  local.get $7
  f64.const 2.356194490192345
  f64.add
  call $~lib/math/NativeMath.cos
  local.set $16
  local.get $7
  call $~lib/math/NativeMath.cos
  local.set $17
  local.get $7
  f64.const 3.141592653589793
  f64.add
  call $~lib/math/NativeMath.cos
  local.set $18
  local.get $7
  f64.const -0.7853981633974483
  f64.add
  call $~lib/math/NativeMath.cos
  local.set $19
  local.get $7
  f64.const -1.5707963267948966
  f64.add
  call $~lib/math/NativeMath.cos
  local.set $20
  local.get $7
  f64.const -2.356194490192345
  f64.add
  call $~lib/math/NativeMath.cos
  local.set $21
  loop $for-loop|0
   local.get $5
   local.get $6
   i32.lt_s
   if
    local.get $2
    local.get $5
    i32.mul
    i32.const 2
    i32.shl
    local.set $22
    i32.const 0
    local.set $12
    loop $for-loop|1
     local.get $2
     local.get $12
     i32.gt_s
     if
      f64.const 0
      local.set $13
      f64.const 0
      local.set $7
      f64.const 0
      local.set $14
      i32.const -1
      local.set $10
      loop $for-loop|2
       local.get $10
       i32.const 1
       i32.le_s
       if
        local.get $5
        local.get $10
        i32.add
        local.tee $11
        i32.const 0
        i32.lt_s
        local.get $3
        local.get $11
        i32.le_s
        i32.or
        i32.eqz
        if
         local.get $2
         local.get $11
         i32.mul
         i32.const 2
         i32.shl
         local.set $23
         i32.const -1
         local.set $11
         loop $for-loop|3
          local.get $11
          i32.const 1
          i32.le_s
          if
           local.get $11
           local.get $12
           i32.add
           local.tee $24
           i32.const 0
           i32.lt_s
           local.get $2
           local.get $24
           i32.le_s
           i32.or
           i32.eqz
           if
            local.get $13
            local.get $0
            local.get $23
            local.get $24
            i32.const 2
            i32.shl
            i32.add
            i32.add
            local.tee $24
            i32.load8_u
            f64.convert_i32_u
            local.get $10
            local.get $11
            i32.and
            i32.const -1
            i32.eq
            if (result f64)
             local.get $8
            else
             local.get $11
             i32.eqz
             local.get $10
             i32.const -1
             i32.eq
             i32.and
             if (result f64)
              local.get $15
             else
              local.get $11
              i32.const 1
              i32.eq
              local.get $10
              i32.const -1
              i32.eq
              i32.and
              if (result f64)
               local.get $16
              else
               local.get $10
               i32.eqz
               local.get $11
               i32.const -1
               i32.eq
               i32.and
               if (result f64)
                local.get $17
               else
                local.get $10
                local.get $11
                i32.or
                if (result f64)
                 local.get $10
                 i32.eqz
                 local.get $11
                 i32.const 1
                 i32.eq
                 i32.and
                 if (result f64)
                  local.get $18
                 else
                  local.get $11
                  i32.const -1
                  i32.eq
                  local.get $10
                  i32.const 1
                  i32.eq
                  i32.and
                  if (result f64)
                   local.get $19
                  else
                   local.get $11
                   i32.eqz
                   local.get $10
                   i32.const 1
                   i32.eq
                   i32.and
                   if (result f64)
                    local.get $20
                   else
                    local.get $21
                    f64.const 0
                    local.get $11
                    i32.const 1
                    i32.eq
                    local.get $10
                    i32.const 1
                    i32.eq
                    i32.and
                    select
                   end
                  end
                 end
                else
                 f64.const 1
                end
               end
              end
             end
            end
            local.tee $9
            f64.mul
            f64.add
            local.set $13
            local.get $14
            local.get $24
            i32.load8_u offset=2
            f64.convert_i32_u
            local.get $9
            f64.mul
            f64.add
            local.set $14
            local.get $7
            local.get $24
            i32.load8_u offset=1
            f64.convert_i32_u
            local.get $9
            f64.mul
            f64.add
            local.set $7
           end
           local.get $11
           i32.const 1
           i32.add
           local.set $11
           br $for-loop|3
          end
         end
        end
        local.get $10
        i32.const 1
        i32.add
        local.set $10
        br $for-loop|2
       end
      end
      local.get $22
      local.get $12
      i32.const 2
      i32.shl
      i32.add
      local.tee $10
      local.get $1
      i32.add
      block $assembly/math/clamp255|inlined.41 (result i32)
       i32.const 0
       local.get $13
       f64.const 128
       f64.add
       f32.demote_f64
       local.tee $4
       local.get $4
       f32.ne
       br_if $assembly/math/clamp255|inlined.41
       drop
       i32.const 0
       local.get $4
       f32.const 0
       f32.lt
       br_if $assembly/math/clamp255|inlined.41
       drop
       i32.const 255
       local.get $4
       f32.const 255
       f32.gt
       br_if $assembly/math/clamp255|inlined.41
       drop
       local.get $4
       i32.trunc_sat_f32_u
      end
      i32.store8
      local.get $1
      local.get $10
      i32.add
      block $assembly/math/clamp255|inlined.42 (result i32)
       i32.const 0
       local.get $7
       f64.const 128
       f64.add
       f32.demote_f64
       local.tee $4
       local.get $4
       f32.ne
       br_if $assembly/math/clamp255|inlined.42
       drop
       i32.const 0
       local.get $4
       f32.const 0
       f32.lt
       br_if $assembly/math/clamp255|inlined.42
       drop
       i32.const 255
       local.get $4
       f32.const 255
       f32.gt
       br_if $assembly/math/clamp255|inlined.42
       drop
       local.get $4
       i32.trunc_sat_f32_u
      end
      i32.store8 offset=1
      local.get $1
      local.get $10
      i32.add
      block $assembly/math/clamp255|inlined.43 (result i32)
       i32.const 0
       local.get $14
       f64.const 128
       f64.add
       f32.demote_f64
       local.tee $4
       local.get $4
       f32.ne
       br_if $assembly/math/clamp255|inlined.43
       drop
       i32.const 0
       local.get $4
       f32.const 0
       f32.lt
       br_if $assembly/math/clamp255|inlined.43
       drop
       i32.const 255
       local.get $4
       f32.const 255
       f32.gt
       br_if $assembly/math/clamp255|inlined.43
       drop
       local.get $4
       i32.trunc_sat_f32_u
      end
      i32.store8 offset=2
      local.get $1
      local.get $10
      i32.add
      local.get $0
      local.get $10
      i32.add
      i32.load8_u offset=3
      i32.store8 offset=3
      local.get $12
      i32.const 1
      i32.add
      local.set $12
      br $for-loop|1
     end
    end
    local.get $5
    i32.const 1
    i32.add
    local.set $5
    br $for-loop|0
   end
  end
 )
 (func $assembly/pdn_effects/frostedGlass (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 f32) (param $5 f32) (param $6 i32) (param $7 i32) (param $8 i32)
  (local $9 i32)
  (local $10 i32)
  (local $11 f32)
  (local $12 f64)
  (local $13 i32)
  (local $14 i32)
  (local $15 i32)
  (local $16 i32)
  (local $17 i32)
  (local $18 i32)
  (local $19 f32)
  (local $20 i32)
  (local $21 f64)
  local.get $5
  local.get $4
  f32.sub
  local.set $19
  loop $for-loop|0
   local.get $7
   local.get $8
   i32.lt_s
   if
    local.get $2
    local.get $7
    i32.mul
    i32.const 2
    i32.shl
    local.set $20
    i32.const 0
    local.set $10
    loop $for-loop|1
     local.get $2
     local.get $10
     i32.gt_s
     if
      i32.const 0
      local.set $13
      i32.const 0
      local.set $14
      i32.const 0
      local.set $15
      i32.const 0
      local.set $16
      i32.const 0
      local.set $17
      loop $for-loop|2
       local.get $6
       local.get $17
       i32.gt_s
       if
        f32.const 0
        local.set $5
        f32.const 0
        local.set $11
        i32.const 0
        local.set $18
        i32.const 0
        local.set $9
        loop $for-loop|3
         local.get $9
         i32.const 10
         i32.lt_s
         if
          block $for-break3
           global.get $assembly/pdn_effects/seed
           i32.const 1664525
           i32.mul
           i32.const 1013904223
           i32.add
           global.set $assembly/pdn_effects/seed
           global.get $assembly/pdn_effects/seed
           f64.convert_i32_u
           f64.const 2.3283064365386963e-10
           f64.mul
           f64.const 3.141592653589793
           f64.mul
           f64.const 2
           f64.mul
           local.set $12
           global.get $assembly/pdn_effects/seed
           i32.const 1664525
           i32.mul
           i32.const 1013904223
           i32.add
           global.set $assembly/pdn_effects/seed
           global.get $assembly/pdn_effects/seed
           f64.convert_i32_u
           f64.const 2.3283064365386963e-10
           f64.mul
           local.get $19
           f64.promote_f32
           f64.mul
           local.get $4
           f64.promote_f32
           f64.add
           local.set $21
           local.get $10
           f32.convert_i32_s
           local.get $12
           call $~lib/math/NativeMath.cos
           local.get $21
           f64.mul
           f32.demote_f64
           f32.add
           local.tee $5
           local.get $2
           f32.convert_i32_s
           f32.lt
           local.get $5
           f32.const 0
           f32.ge
           i32.and
           local.get $7
           f32.convert_i32_s
           local.get $12
           call $~lib/math/NativeMath.sin
           local.get $21
           f64.mul
           f32.demote_f64
           f32.add
           local.tee $11
           f32.const 0
           f32.ge
           i32.and
           local.get $11
           local.get $3
           f32.convert_i32_s
           f32.lt
           i32.and
           if
            i32.const 1
            local.set $18
            br $for-break3
           end
           local.get $9
           i32.const 1
           i32.add
           local.set $9
           br $for-loop|3
          end
         end
        end
        local.get $13
        local.get $2
        i32.const 1
        i32.sub
        f32.convert_i32_s
        f64.promote_f32
        local.get $18
        if (result f32)
         local.get $5
        else
         local.get $7
         f32.convert_i32_s
         local.set $11
         local.get $10
         f32.convert_i32_s
        end
        f64.promote_f32
        f64.const 0
        f64.max
        f64.min
        i32.trunc_sat_f64_s
        local.get $3
        i32.const 1
        i32.sub
        f32.convert_i32_s
        f64.promote_f32
        local.get $11
        f64.promote_f32
        f64.const 0
        f64.max
        f64.min
        i32.trunc_sat_f64_s
        local.get $2
        i32.mul
        i32.add
        i32.const 2
        i32.shl
        local.get $0
        i32.add
        local.tee $9
        i32.load8_u
        i32.add
        local.set $13
        local.get $14
        local.get $9
        i32.load8_u offset=1
        i32.add
        local.set $14
        local.get $15
        local.get $9
        i32.load8_u offset=2
        i32.add
        local.set $15
        local.get $16
        local.get $9
        i32.load8_u offset=3
        i32.add
        local.set $16
        local.get $17
        i32.const 1
        i32.add
        local.set $17
        br $for-loop|2
       end
      end
      local.get $20
      local.get $10
      i32.const 2
      i32.shl
      i32.add
      local.get $1
      i32.add
      local.tee $9
      local.get $13
      local.get $6
      i32.div_u
      i32.store8
      local.get $9
      local.get $14
      local.get $6
      i32.div_u
      i32.store8 offset=1
      local.get $9
      local.get $15
      local.get $6
      i32.div_u
      i32.store8 offset=2
      local.get $9
      local.get $16
      local.get $6
      i32.div_u
      i32.store8 offset=3
      local.get $10
      i32.const 1
      i32.add
      local.set $10
      br $for-loop|1
     end
    end
    local.get $7
    i32.const 1
    i32.add
    local.set $7
    br $for-loop|0
   end
  end
 )
 (func $assembly/pdn_effects/redEyeRemove (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 f32) (param $6 i32) (param $7 i32)
  (local $8 i32)
  (local $9 f64)
  (local $10 i32)
  (local $11 i32)
  (local $12 f64)
  (local $13 i32)
  (local $14 f64)
  (local $15 f32)
  (local $16 i32)
  (local $17 i32)
  (local $18 f64)
  loop $for-loop|0
   local.get $6
   local.get $7
   i32.lt_s
   if
    local.get $2
    local.get $6
    i32.mul
    i32.const 2
    i32.shl
    local.set $10
    i32.const 0
    local.set $3
    loop $for-loop|1
     local.get $2
     local.get $3
     i32.gt_s
     if
      local.get $10
      local.get $3
      i32.const 2
      i32.shl
      i32.add
      local.tee $13
      local.get $0
      i32.add
      local.tee $8
      i32.load8_u
      local.set $16
      local.get $8
      i32.load8_u offset=3
      local.set $11
      local.get $8
      i32.load8_u offset=2
      local.tee $17
      f64.convert_i32_u
      local.tee $14
      local.get $16
      f64.convert_i32_u
      local.tee $18
      local.get $8
      i32.load8_u offset=1
      local.tee $8
      f64.convert_i32_u
      local.tee $12
      f64.max
      f64.max
      local.tee $9
      local.get $12
      local.get $18
      f64.min
      local.get $14
      f64.min
      f64.sub
      local.tee $12
      f64.const 0
      f64.ne
      local.get $9
      f64.const 0
      f64.ne
      i32.and
      if (result f32)
       local.get $12
       f32.demote_f64
       local.get $9
       f32.demote_f64
       f32.div
      else
       f32.const 0
      end
      f32.const 255
      f32.mul
      i32.trunc_sat_f32_s
      i32.const 100
      i32.gt_s
      if (result i32)
       local.get $4
       f64.convert_i32_s
       local.get $16
       f64.convert_i32_u
       local.get $17
       f64.convert_i32_u
       local.get $8
       f64.convert_i32_u
       f64.max
       f64.sub
       f64.lt
      else
       i32.const 0
      end
      if
       local.get $1
       local.get $13
       i32.add
       block $assembly/math/clamp255|inlined.44 (result i32)
        i32.const 0
        local.get $16
        f32.convert_i32_u
        f32.const 0.30000001192092896
        f32.mul
        local.get $8
        f32.convert_i32_u
        f32.const 0.5899999737739563
        f32.mul
        f32.add
        local.get $17
        f32.convert_i32_u
        f32.const 0.10999999940395355
        f32.mul
        f32.add
        local.get $5
        f32.mul
        local.tee $15
        local.get $15
        f32.ne
        br_if $assembly/math/clamp255|inlined.44
        drop
        i32.const 0
        local.get $15
        f32.const 0
        f32.lt
        br_if $assembly/math/clamp255|inlined.44
        drop
        i32.const 255
        local.get $15
        f32.const 255
        f32.gt
        br_if $assembly/math/clamp255|inlined.44
        drop
        local.get $15
        i32.trunc_sat_f32_u
       end
       i32.store8
      else
       local.get $1
       local.get $13
       i32.add
       local.get $16
       i32.store8
      end
      local.get $1
      local.get $13
      i32.add
      local.tee $13
      local.get $8
      i32.store8 offset=1
      local.get $13
      local.get $17
      i32.store8 offset=2
      local.get $13
      local.get $11
      i32.store8 offset=3
      local.get $3
      i32.const 1
      i32.add
      local.set $3
      br $for-loop|1
     end
    end
    local.get $6
    i32.const 1
    i32.add
    local.set $6
    br $for-loop|0
   end
  end
 )
 (func $~lib/rt/__visit_members (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  block $folding-inner2
   block $folding-inner1
    block $folding-inner0
     block $invalid
      block $~lib/array/Array<~lib/array/Array<i32>>
       block $~lib/array/Array<i32>
        block $assembly/math/RGB
         block $assembly/math/HSV
          block $~lib/string/String
           block $~lib/arraybuffer/ArrayBuffer
            block $~lib/object/Object
             local.get $0
             i32.const 8
             i32.sub
             i32.load
             br_table $~lib/object/Object $~lib/arraybuffer/ArrayBuffer $~lib/string/String $folding-inner1 $assembly/math/HSV $assembly/math/RGB $~lib/array/Array<i32> $~lib/array/Array<~lib/array/Array<i32>> $folding-inner1 $folding-inner1 $folding-inner1 $invalid
            end
            return
           end
           return
          end
          return
         end
         return
        end
        return
       end
       global.get $~lib/memory/__stack_pointer
       i32.const 4
       i32.sub
       global.set $~lib/memory/__stack_pointer
       global.get $~lib/memory/__stack_pointer
       i32.const 8672
       i32.lt_s
       br_if $folding-inner0
       global.get $~lib/memory/__stack_pointer
       i32.const 0
       i32.store
       br $folding-inner2
      end
      global.get $~lib/memory/__stack_pointer
      i32.const 4
      i32.sub
      global.set $~lib/memory/__stack_pointer
      global.get $~lib/memory/__stack_pointer
      i32.const 8672
      i32.lt_s
      br_if $folding-inner0
      global.get $~lib/memory/__stack_pointer
      i32.const 0
      i32.store
      global.get $~lib/memory/__stack_pointer
      local.get $0
      i32.store
      local.get $0
      i32.load offset=4
      local.set $1
      global.get $~lib/memory/__stack_pointer
      local.get $0
      i32.store
      local.get $1
      local.get $0
      i32.load offset=12
      i32.const 2
      i32.shl
      i32.add
      local.set $2
      loop $while-continue|0
       local.get $1
       local.get $2
       i32.lt_u
       if
        local.get $1
        i32.load
        local.tee $3
        if
         local.get $3
         call $~lib/rt/itcms/__visit
        end
        local.get $1
        i32.const 4
        i32.add
        local.set $1
        br $while-continue|0
       end
      end
      br $folding-inner2
     end
     unreachable
    end
    i32.const 41472
    i32.const 41520
    i32.const 1
    i32.const 1
    call $~lib/builtins/abort
    unreachable
   end
   local.get $0
   i32.load
   call $~lib/rt/itcms/__visit
   return
  end
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $0
  i32.load
  call $~lib/rt/itcms/__visit
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~start
  (local $0 i32)
  memory.size
  i32.const 16
  i32.shl
  i32.const 41440
  i32.sub
  i32.const 1
  i32.shr_u
  global.set $~lib/rt/itcms/threshold
  i32.const 1172
  i32.const 1168
  i32.store
  i32.const 1176
  i32.const 1168
  i32.store
  i32.const 1168
  global.set $~lib/rt/itcms/pinSpace
  i32.const 1204
  i32.const 1200
  i32.store
  i32.const 1208
  i32.const 1200
  i32.store
  i32.const 1200
  global.set $~lib/rt/itcms/toSpace
  i32.const 1348
  i32.const 1344
  i32.store
  i32.const 1352
  i32.const 1344
  i32.store
  i32.const 1344
  global.set $~lib/rt/itcms/fromSpace
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  block $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i32.const 8672
   i32.lt_s
   br_if $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i64.const 0
   i64.store
   global.get $~lib/memory/__stack_pointer
   i32.const 12
   i32.const 4
   call $~lib/rt/itcms/__new
   local.tee $0
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   global.get $~lib/memory/__stack_pointer
   local.get $0
   call $~lib/object/Object#constructor
   local.tee $0
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   local.get $0
   f32.const 0
   f32.store
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   local.get $0
   f32.const 0
   f32.store offset=4
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   local.get $0
   f32.const 0
   f32.store offset=8
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $0
   global.set $assembly/math/_hsv
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.sub
   global.set $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 8672
   i32.lt_s
   br_if $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i64.const 0
   i64.store
   global.get $~lib/memory/__stack_pointer
   i32.const 12
   i32.const 5
   call $~lib/rt/itcms/__new
   local.tee $0
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   global.get $~lib/memory/__stack_pointer
   local.get $0
   call $~lib/object/Object#constructor
   local.tee $0
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   local.get $0
   f32.const 0
   f32.store
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   local.get $0
   f32.const 0
   f32.store offset=4
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store offset=4
   local.get $0
   f32.const 0
   f32.store offset=8
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.add
   global.set $~lib/memory/__stack_pointer
   local.get $0
   global.set $assembly/math/_rgb
   global.get $~lib/memory/__stack_pointer
   i32.const 4
   i32.sub
   global.set $~lib/memory/__stack_pointer
   global.get $~lib/memory/__stack_pointer
   i32.const 8672
   i32.lt_s
   br_if $folding-inner1
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.store
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.const 7
   i32.const 0
   call $~lib/rt/__newArray
   local.tee $0
   i32.store
   local.get $0
   i32.const 0
   i32.const 8
   i32.const 6
   i32.const 1456
   call $~lib/rt/__newArray
   call $~lib/array/Array<~lib/array/Array<i32>>#__set
   local.get $0
   i32.const 1
   i32.const 8
   i32.const 6
   i32.const 1520
   call $~lib/rt/__newArray
   call $~lib/array/Array<~lib/array/Array<i32>>#__set
   local.get $0
   i32.const 2
   i32.const 8
   i32.const 6
   i32.const 1584
   call $~lib/rt/__newArray
   call $~lib/array/Array<~lib/array/Array<i32>>#__set
   local.get $0
   i32.const 3
   i32.const 8
   i32.const 6
   i32.const 1648
   call $~lib/rt/__newArray
   call $~lib/array/Array<~lib/array/Array<i32>>#__set
   local.get $0
   i32.const 4
   i32.const 8
   i32.const 6
   i32.const 1712
   call $~lib/rt/__newArray
   call $~lib/array/Array<~lib/array/Array<i32>>#__set
   local.get $0
   i32.const 5
   i32.const 8
   i32.const 6
   i32.const 1776
   call $~lib/rt/__newArray
   call $~lib/array/Array<~lib/array/Array<i32>>#__set
   local.get $0
   i32.const 6
   i32.const 8
   i32.const 6
   i32.const 1840
   call $~lib/rt/__newArray
   call $~lib/array/Array<~lib/array/Array<i32>>#__set
   local.get $0
   i32.const 7
   i32.const 8
   i32.const 6
   i32.const 1904
   call $~lib/rt/__newArray
   call $~lib/array/Array<~lib/array/Array<i32>>#__set
   local.get $0
   global.set $assembly/filters/BAYER_MATRIX
   global.get $~lib/memory/__stack_pointer
   i32.const 4
   i32.add
   global.set $~lib/memory/__stack_pointer
   return
  end
  i32.const 41472
  i32.const 41520
  i32.const 1
  i32.const 1
  call $~lib/builtins/abort
  unreachable
 )
 (func $~lib/array/Array<~lib/array/Array<i32>>#__set (param $0 i32) (param $1 i32) (param $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  block $folding-inner0
   global.get $~lib/memory/__stack_pointer
   i32.const 8672
   i32.lt_s
   br_if $folding-inner0
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store
   local.get $1
   local.get $0
   i32.load offset=12
   i32.ge_u
   if
    local.get $1
    i32.const 0
    i32.lt_s
    if
     i32.const 1248
     i32.const 1968
     i32.const 130
     i32.const 22
     call $~lib/builtins/abort
     unreachable
    end
    local.get $1
    i32.const 1
    i32.add
    local.tee $6
    local.set $3
    global.get $~lib/memory/__stack_pointer
    i32.const 4
    i32.sub
    global.set $~lib/memory/__stack_pointer
    global.get $~lib/memory/__stack_pointer
    i32.const 8672
    i32.lt_s
    br_if $folding-inner0
    global.get $~lib/memory/__stack_pointer
    i32.const 0
    i32.store
    global.get $~lib/memory/__stack_pointer
    local.get $0
    i32.store
    local.get $3
    local.get $0
    i32.load offset=8
    local.tee $4
    i32.const 2
    i32.shr_u
    i32.gt_u
    if
     local.get $3
     i32.const 268435455
     i32.gt_u
     if
      i32.const 2016
      i32.const 1968
      i32.const 19
      i32.const 48
      call $~lib/builtins/abort
      unreachable
     end
     global.get $~lib/memory/__stack_pointer
     local.get $0
     i32.store
     block $__inlined_func$~lib/rt/itcms/__renew$210
      i32.const 1073741820
      local.get $4
      i32.const 1
      i32.shl
      local.tee $4
      local.get $4
      i32.const 1073741820
      i32.ge_u
      select
      local.tee $4
      i32.const 8
      local.get $3
      local.get $3
      i32.const 8
      i32.le_u
      select
      i32.const 2
      i32.shl
      local.tee $3
      local.get $3
      local.get $4
      i32.lt_u
      select
      local.tee $5
      local.get $0
      i32.load
      local.tee $4
      i32.const 20
      i32.sub
      local.tee $7
      i32.load
      i32.const -4
      i32.and
      i32.const 16
      i32.sub
      i32.le_u
      if
       local.get $7
       local.get $5
       i32.store offset=16
       local.get $4
       local.set $3
       br $__inlined_func$~lib/rt/itcms/__renew$210
      end
      local.get $5
      local.get $7
      i32.load offset=12
      call $~lib/rt/itcms/__new
      local.tee $3
      local.get $4
      local.get $5
      local.get $7
      i32.load offset=16
      local.tee $7
      local.get $5
      local.get $7
      i32.lt_u
      select
      memory.copy
     end
     local.get $3
     local.get $4
     i32.ne
     if
      local.get $0
      local.get $3
      i32.store
      local.get $0
      local.get $3
      i32.store offset=4
      local.get $0
      local.get $3
      i32.const 0
      call $~lib/rt/itcms/__link
     end
     local.get $0
     local.get $5
     i32.store offset=8
    end
    global.get $~lib/memory/__stack_pointer
    i32.const 4
    i32.add
    global.set $~lib/memory/__stack_pointer
    global.get $~lib/memory/__stack_pointer
    local.get $0
    i32.store
    local.get $0
    local.get $6
    i32.store offset=12
   end
   global.get $~lib/memory/__stack_pointer
   local.get $0
   i32.store
   local.get $0
   i32.load offset=4
   local.get $1
   i32.const 2
   i32.shl
   i32.add
   local.get $2
   i32.store
   local.get $0
   local.get $2
   i32.const 1
   call $~lib/rt/itcms/__link
   global.get $~lib/memory/__stack_pointer
   i32.const 4
   i32.add
   global.set $~lib/memory/__stack_pointer
   return
  end
  i32.const 41472
  i32.const 41520
  i32.const 1
  i32.const 1
  call $~lib/builtins/abort
  unreachable
 )
 (func $~lib/arraybuffer/ArrayBufferView#constructor (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 8672
  i32.lt_s
  if
   i32.const 41472
   i32.const 41520
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store offset=8
  local.get $0
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 12
   i32.const 3
   call $~lib/rt/itcms/__new
   local.tee $0
   i32.store
  end
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store offset=4
  local.get $0
  i32.const 0
  i32.store
  local.get $0
  i32.const 0
  i32.const 0
  call $~lib/rt/itcms/__link
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store offset=4
  local.get $0
  i32.const 0
  i32.store offset=4
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store offset=4
  local.get $0
  i32.const 0
  i32.store offset=8
  local.get $1
  i32.const 1073741820
  local.get $2
  i32.shr_u
  i32.gt_u
  if
   i32.const 2016
   i32.const 2064
   i32.const 19
   i32.const 57
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  local.get $1
  local.get $2
  i32.shl
  local.tee $1
  i32.const 1
  call $~lib/rt/itcms/__new
  local.tee $2
  i32.store offset=8
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store offset=4
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=12
  local.get $0
  local.get $2
  i32.store
  local.get $0
  local.get $2
  i32.const 0
  call $~lib/rt/itcms/__link
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store offset=4
  local.get $0
  local.get $2
  i32.store offset=4
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store offset=4
  local.get $0
  local.get $1
  i32.store offset=8
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $0
 )
 (func $~lib/typedarray/Uint8Array#constructor (param $0 i32) (result i32)
  (local $1 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 8672
  i32.lt_s
  if
   i32.const 41472
   i32.const 41520
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.const 8
  call $~lib/rt/itcms/__new
  local.tee $1
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  global.get $~lib/memory/__stack_pointer
  local.get $1
  local.get $0
  i32.const 0
  call $~lib/arraybuffer/ArrayBufferView#constructor
  local.tee $0
  i32.store
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $0
 )
 (func $assembly/camera_raw/applyCameraRaw (param $0 i32) (param $1 i32) (param $2 i32) (param $3 f32) (param $4 f32) (param $5 f32) (param $6 f32) (param $7 f32) (param $8 f32) (param $9 f32) (param $10 f32) (param $11 f32) (param $12 f32) (param $13 f32) (param $14 f32) (param $15 f32) (param $16 f32) (param $17 f32) (param $18 f32) (param $19 f32) (param $20 i32) (param $21 i32) (param $22 i32) (param $23 i32)
  (local $24 i32)
  (local $25 i32)
  (local $26 i32)
  (local $27 f32)
  (local $28 f64)
  (local $29 f64)
  (local $30 f64)
  (local $31 i32)
  (local $32 i32)
  (local $33 i32)
  (local $34 i32)
  (local $35 i32)
  (local $36 f32)
  (local $37 i32)
  (local $38 f32)
  (local $39 f32)
  (local $40 f32)
  (local $41 f32)
  (local $42 i32)
  (local $43 f32)
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 8672
  i32.lt_s
  if
   i32.const 41472
   i32.const 41520
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store offset=8
  local.get $22
  i32.const 0
  local.get $22
  i32.const 0
  i32.ge_s
  select
  local.set $22
  local.get $2
  local.get $2
  local.get $23
  local.get $23
  i32.const 0
  i32.lt_s
  select
  local.tee $23
  local.get $2
  local.get $23
  i32.lt_s
  select
  local.set $35
  f64.const 2
  local.get $3
  f32.const 100
  f32.div
  f32.const 2
  f32.mul
  f64.promote_f32
  call $~lib/math/NativeMath.pow
  f32.demote_f64
  local.set $41
  local.get $4
  f32.const 100
  f32.add
  f32.const 100
  f32.div
  local.set $40
  local.get $7
  f32.const 100
  f32.div
  local.set $39
  local.get $8
  f32.const 100
  f32.div
  local.set $38
  local.get $10
  f32.const 100
  f32.add
  f32.const 100
  f32.div
  local.set $43
  local.get $9
  f32.const 100
  f32.div
  local.set $36
  local.get $21
  i32.const 256
  i32.add
  local.set $34
  local.get $21
  i32.const 512
  i32.add
  local.set $33
  local.get $21
  i32.const 768
  i32.add
  local.set $32
  loop $for-loop|0
   local.get $22
   local.get $35
   i32.lt_s
   if
    local.get $1
    local.get $22
    i32.mul
    i32.const 2
    i32.shl
    local.set $31
    i32.const 0
    local.set $42
    loop $for-loop|1
     local.get $1
     local.get $42
     i32.gt_s
     if
      local.get $31
      local.get $42
      i32.const 2
      i32.shl
      i32.add
      local.tee $37
      local.get $0
      i32.add
      local.tee $2
      i32.load8_u
      f32.convert_i32_u
      local.set $3
      local.get $2
      i32.load8_u offset=1
      f32.convert_i32_u
      local.set $4
      local.get $2
      i32.load8_u offset=2
      f32.convert_i32_u
      local.set $7
      local.get $2
      i32.load8_u offset=3
      if
       block $assembly/camera_raw/srgbToLinear|inlined.0 (result f32)
        f32.const 0
        local.get $3
        f32.const 255
        f32.div
        local.tee $3
        f32.const 0
        f32.le
        br_if $assembly/camera_raw/srgbToLinear|inlined.0
        drop
        f32.const 1
        local.get $3
        f32.const 1
        f32.ge
        br_if $assembly/camera_raw/srgbToLinear|inlined.0
        drop
        local.get $3
        f32.const 0.040449999272823334
        f32.le
        if (result f32)
         local.get $3
         f32.const 12.920000076293945
         f32.div
        else
         local.get $3
         f32.const 0.054999999701976776
         f32.add
         f64.promote_f32
         f64.const 1.055
         f64.div
         f64.const 2.4
         call $~lib/math/NativeMath.pow
         f32.demote_f64
        end
       end
       local.get $41
       f32.mul
       local.set $3
       block $assembly/camera_raw/srgbToLinear|inlined.1 (result f32)
        f32.const 0
        local.get $4
        f32.const 255
        f32.div
        local.tee $4
        f32.const 0
        f32.le
        br_if $assembly/camera_raw/srgbToLinear|inlined.1
        drop
        f32.const 1
        local.get $4
        f32.const 1
        f32.ge
        br_if $assembly/camera_raw/srgbToLinear|inlined.1
        drop
        local.get $4
        f32.const 0.040449999272823334
        f32.le
        if (result f32)
         local.get $4
         f32.const 12.920000076293945
         f32.div
        else
         local.get $4
         f32.const 0.054999999701976776
         f32.add
         f64.promote_f32
         f64.const 1.055
         f64.div
         f64.const 2.4
         call $~lib/math/NativeMath.pow
         f32.demote_f64
        end
       end
       local.get $41
       f32.mul
       local.set $4
       block $assembly/camera_raw/srgbToLinear|inlined.2 (result f32)
        f32.const 0
        local.get $7
        f32.const 255
        f32.div
        local.tee $7
        f32.const 0
        f32.le
        br_if $assembly/camera_raw/srgbToLinear|inlined.2
        drop
        f32.const 1
        local.get $7
        f32.const 1
        f32.ge
        br_if $assembly/camera_raw/srgbToLinear|inlined.2
        drop
        local.get $7
        f32.const 0.040449999272823334
        f32.le
        if (result f32)
         local.get $7
         f32.const 12.920000076293945
         f32.div
        else
         local.get $7
         f32.const 0.054999999701976776
         f32.add
         f64.promote_f32
         f64.const 1.055
         f64.div
         f64.const 2.4
         call $~lib/math/NativeMath.pow
         f32.demote_f64
        end
       end
       local.get $41
       f32.mul
       local.set $7
       local.get $39
       f32.const 0
       f32.ne
       if
        local.get $7
        f32.const 1
        local.get $39
        f32.const 0.11999999731779099
        f32.mul
        local.tee $8
        f32.sub
        f32.mul
        local.set $7
        local.get $4
        local.get $39
        f32.const 0.019999999552965164
        f32.mul
        f32.const 1
        f32.add
        f32.mul
        local.set $4
        local.get $3
        local.get $8
        f32.const 1
        f32.add
        f32.mul
        local.set $3
       end
       local.get $38
       f32.const 0
       f32.ne
       if
        local.get $7
        local.get $38
        f32.const 0.05999999865889549
        f32.mul
        f32.const 1
        f32.add
        local.tee $8
        f32.mul
        local.set $7
        local.get $4
        f32.const 1
        local.get $38
        f32.const 0.07999999821186066
        f32.mul
        f32.sub
        f32.mul
        local.set $4
        local.get $3
        local.get $8
        f32.mul
        local.set $3
       end
       local.get $3
       f32.const 0.2125999927520752
       f32.mul
       local.get $4
       f32.const 0.7152000069618225
       f32.mul
       f32.add
       local.get $7
       f32.const 0.0722000002861023
       f32.mul
       f32.add
       local.tee $9
       f32.const 1.0000000474974513e-03
       f32.gt
       if
        local.get $6
        f32.const 0
        f32.ne
        if (result f32)
         local.get $9
         local.get $6
         f32.const 100
         f32.div
         f32.const 1
         local.get $9
         local.get $9
         f32.add
         f32.sub
         f64.promote_f32
         f64.const 0
         f64.max
         f32.demote_f64
         f32.mul
         f32.const 0.4000000059604645
         f32.mul
         local.get $9
         f64.promote_f32
         f64.sqrt
         f32.demote_f64
         f32.mul
         f32.add
        else
         local.get $9
        end
        local.set $8
        local.get $3
        local.get $5
        f32.const 0
        f32.ne
        if (result f32)
         local.get $8
         local.get $5
         f32.const 100
         f32.div
         local.get $9
         f32.const -0.5
         f32.add
         f32.const 2
         f32.mul
         f64.promote_f32
         f64.const 0
         f64.max
         f32.demote_f64
         f32.mul
         f32.const 0.6000000238418579
         f32.mul
         f32.const 1.100000023841858
         local.get $9
         f32.sub
         f32.mul
         f32.add
        else
         local.get $8
        end
        f64.promote_f32
        f64.const 0
        f64.max
        f32.demote_f64
        local.get $9
        f32.div
        local.tee $8
        f32.mul
        local.set $3
        local.get $7
        local.get $8
        f32.mul
        local.set $7
        local.get $4
        local.get $8
        f32.mul
        local.set $4
       end
       local.get $11
       f32.const 0
       f32.ne
       local.tee $2
       local.get $12
       f32.const 0
       f32.ne
       i32.or
       local.get $13
       f32.const 0
       f32.ne
       i32.or
       local.get $14
       f32.const 0
       f32.ne
       i32.or
       local.get $15
       f32.const 0
       f32.ne
       i32.or
       local.get $16
       f32.const 0
       f32.ne
       i32.or
       local.get $17
       f32.const 0
       f32.ne
       i32.or
       local.get $18
       f32.const 0
       f32.ne
       i32.or
       local.get $19
       f32.const 0
       f32.ne
       i32.or
       if
        local.get $2
        if
         local.get $3
         local.get $11
         f32.const 100
         f32.div
         f32.const 1
         f32.add
         f32.mul
         local.set $3
        end
        local.get $9
        f32.const -0.5
        f32.add
        f64.promote_f32
        f64.const 0
        f64.max
        f32.demote_f64
        f32.const 2
        f32.mul
        local.set $10
        local.get $12
        f32.const 0
        f32.ne
        if
         local.get $3
         local.get $12
         f32.const 100
         f32.div
         local.get $10
         f32.mul
         f32.const 1.5
         f32.mul
         f32.const 1
         f32.add
         f32.mul
         local.set $3
        end
        f32.const 0.5
        local.get $9
        f32.sub
        f64.promote_f32
        f64.const 0
        f64.max
        f32.demote_f64
        f32.const 2
        f32.mul
        local.set $8
        local.get $13
        f32.const 0
        f32.ne
        if
         local.get $3
         local.get $13
         f32.const 100
         f32.div
         local.get $8
         f32.mul
         f32.const 1.5
         f32.mul
         f32.const 1
         f32.add
         f32.mul
         local.set $3
        end
        local.get $14
        f32.const 0
        f32.ne
        if
         local.get $4
         local.get $14
         f32.const 100
         f32.div
         f32.const 1
         f32.add
         f32.mul
         local.set $4
        end
        local.get $15
        f32.const 0
        f32.ne
        if
         local.get $4
         local.get $15
         f32.const 100
         f32.div
         local.get $10
         f32.mul
         f32.const 1.5
         f32.mul
         f32.const 1
         f32.add
         f32.mul
         local.set $4
        end
        local.get $16
        f32.const 0
        f32.ne
        if
         local.get $4
         local.get $16
         f32.const 100
         f32.div
         local.get $8
         f32.mul
         f32.const 1.5
         f32.mul
         f32.const 1
         f32.add
         f32.mul
         local.set $4
        end
        local.get $17
        f32.const 0
        f32.ne
        if
         local.get $7
         local.get $17
         f32.const 100
         f32.div
         f32.const 1
         f32.add
         f32.mul
         local.set $7
        end
        local.get $18
        f32.const 0
        f32.ne
        if
         local.get $7
         local.get $18
         f32.const 100
         f32.div
         local.get $10
         f32.mul
         f32.const 1.5
         f32.mul
         f32.const 1
         f32.add
         f32.mul
         local.set $7
        end
        local.get $19
        f32.const 0
        f32.ne
        if
         local.get $7
         local.get $19
         f32.const 100
         f32.div
         local.get $8
         f32.mul
         f32.const 1.5
         f32.mul
         f32.const 1
         f32.add
         f32.mul
         local.set $7
        end
       end
       block $assembly/camera_raw/linearToSrgb|inlined.0 (result f32)
        f32.const 0
        local.get $3
        f32.const 0
        f32.le
        br_if $assembly/camera_raw/linearToSrgb|inlined.0
        drop
        f32.const 255
        local.get $3
        f32.const 1
        f32.ge
        br_if $assembly/camera_raw/linearToSrgb|inlined.0
        drop
        local.get $3
        f32.const 3.1308000907301903e-03
        f32.le
        if (result f32)
         local.get $3
         f32.const 12.920000076293945
         f32.mul
        else
         local.get $3
         f64.promote_f32
         f64.const 0.4166666666666667
         call $~lib/math/NativeMath.pow
         f32.demote_f64
         f32.const 1.0549999475479126
         f32.mul
         f32.const -0.054999999701976776
         f32.add
        end
        f32.const 255
        f32.mul
       end
       local.set $3
       block $assembly/camera_raw/linearToSrgb|inlined.1 (result f32)
        f32.const 0
        local.get $4
        f32.const 0
        f32.le
        br_if $assembly/camera_raw/linearToSrgb|inlined.1
        drop
        f32.const 255
        local.get $4
        f32.const 1
        f32.ge
        br_if $assembly/camera_raw/linearToSrgb|inlined.1
        drop
        local.get $4
        f32.const 3.1308000907301903e-03
        f32.le
        if (result f32)
         local.get $4
         f32.const 12.920000076293945
         f32.mul
        else
         local.get $4
         f64.promote_f32
         f64.const 0.4166666666666667
         call $~lib/math/NativeMath.pow
         f32.demote_f64
         f32.const 1.0549999475479126
         f32.mul
         f32.const -0.054999999701976776
         f32.add
        end
        f32.const 255
        f32.mul
       end
       f32.const 255
       f32.div
       local.set $4
       block $assembly/camera_raw/linearToSrgb|inlined.2 (result f32)
        f32.const 0
        local.get $7
        f32.const 0
        f32.le
        br_if $assembly/camera_raw/linearToSrgb|inlined.2
        drop
        f32.const 255
        local.get $7
        f32.const 1
        f32.ge
        br_if $assembly/camera_raw/linearToSrgb|inlined.2
        drop
        local.get $7
        f32.const 3.1308000907301903e-03
        f32.le
        if (result f32)
         local.get $7
         f32.const 12.920000076293945
         f32.mul
        else
         local.get $7
         f64.promote_f32
         f64.const 0.4166666666666667
         call $~lib/math/NativeMath.pow
         f32.demote_f64
         f32.const 1.0549999475479126
         f32.mul
         f32.const -0.054999999701976776
         f32.add
        end
        f32.const 255
        f32.mul
       end
       f32.const 255
       f32.div
       local.set $7
       block $assembly/math/clamp01|inlined.0 (result f32)
        f32.const 0
        local.get $3
        f32.const 255
        f32.div
        f32.const -0.5
        f32.add
        local.get $40
        f32.mul
        f32.const 0.5
        f32.add
        local.tee $3
        local.get $3
        f32.ne
        br_if $assembly/math/clamp01|inlined.0
        drop
        f32.const 0
        local.get $3
        f32.const 0
        f32.lt
        br_if $assembly/math/clamp01|inlined.0
        drop
        f32.const 1
        local.get $3
        f32.const 1
        f32.gt
        br_if $assembly/math/clamp01|inlined.0
        drop
        local.get $3
       end
       f32.const 255
       f32.mul
       local.set $3
       block $assembly/math/clamp01|inlined.1 (result f32)
        f32.const 0
        local.get $4
        f32.const -0.5
        f32.add
        local.get $40
        f32.mul
        f32.const 0.5
        f32.add
        local.tee $4
        local.get $4
        f32.ne
        br_if $assembly/math/clamp01|inlined.1
        drop
        f32.const 0
        local.get $4
        f32.const 0
        f32.lt
        br_if $assembly/math/clamp01|inlined.1
        drop
        f32.const 1
        local.get $4
        f32.const 1
        f32.gt
        br_if $assembly/math/clamp01|inlined.1
        drop
        local.get $4
       end
       f32.const 255
       f32.mul
       local.set $4
       block $assembly/math/clamp01|inlined.2 (result f32)
        f32.const 0
        local.get $7
        f32.const -0.5
        f32.add
        local.get $40
        f32.mul
        f32.const 0.5
        f32.add
        local.tee $7
        local.get $7
        f32.ne
        br_if $assembly/math/clamp01|inlined.2
        drop
        f32.const 0
        local.get $7
        f32.const 0
        f32.lt
        br_if $assembly/math/clamp01|inlined.2
        drop
        f32.const 1
        local.get $7
        f32.const 1
        f32.gt
        br_if $assembly/math/clamp01|inlined.2
        drop
        local.get $7
       end
       f32.const 255
       f32.mul
       local.set $7
       local.get $21
       if
        local.get $34
        block $assembly/math/clamp255|inlined.0 (result i32)
         i32.const 0
         local.get $3
         local.get $3
         f32.ne
         br_if $assembly/math/clamp255|inlined.0
         drop
         i32.const 0
         local.get $3
         f32.const 0
         f32.lt
         br_if $assembly/math/clamp255|inlined.0
         drop
         i32.const 255
         local.get $3
         f32.const 255
         f32.gt
         br_if $assembly/math/clamp255|inlined.0
         drop
         local.get $3
         i32.trunc_sat_f32_u
        end
        i32.const 255
        i32.and
        i32.add
        i32.load8_u
        f32.convert_i32_u
        local.set $3
        local.get $33
        block $assembly/math/clamp255|inlined.1 (result i32)
         i32.const 0
         local.get $4
         local.get $4
         f32.ne
         br_if $assembly/math/clamp255|inlined.1
         drop
         i32.const 0
         local.get $4
         f32.const 0
         f32.lt
         br_if $assembly/math/clamp255|inlined.1
         drop
         i32.const 255
         local.get $4
         f32.const 255
         f32.gt
         br_if $assembly/math/clamp255|inlined.1
         drop
         local.get $4
         i32.trunc_sat_f32_u
        end
        i32.const 255
        i32.and
        i32.add
        i32.load8_u
        f32.convert_i32_u
        local.set $4
        local.get $32
        block $assembly/math/clamp255|inlined.2 (result i32)
         i32.const 0
         local.get $7
         local.get $7
         f32.ne
         br_if $assembly/math/clamp255|inlined.2
         drop
         i32.const 0
         local.get $7
         f32.const 0
         f32.lt
         br_if $assembly/math/clamp255|inlined.2
         drop
         i32.const 255
         local.get $7
         f32.const 255
         f32.gt
         br_if $assembly/math/clamp255|inlined.2
         drop
         local.get $7
         i32.trunc_sat_f32_u
        end
        i32.const 255
        i32.and
        i32.add
        i32.load8_u
        f32.convert_i32_u
        local.set $7
        local.get $21
        block $assembly/math/clamp255|inlined.3 (result i32)
         i32.const 0
         local.get $3
         local.get $3
         f32.ne
         br_if $assembly/math/clamp255|inlined.3
         drop
         i32.const 0
         local.get $3
         f32.const 0
         f32.lt
         br_if $assembly/math/clamp255|inlined.3
         drop
         i32.const 255
         local.get $3
         f32.const 255
         f32.gt
         br_if $assembly/math/clamp255|inlined.3
         drop
         local.get $3
         i32.trunc_sat_f32_u
        end
        i32.const 255
        i32.and
        i32.add
        i32.load8_u
        f32.convert_i32_u
        local.set $3
        local.get $21
        block $assembly/math/clamp255|inlined.4 (result i32)
         i32.const 0
         local.get $4
         local.get $4
         f32.ne
         br_if $assembly/math/clamp255|inlined.4
         drop
         i32.const 0
         local.get $4
         f32.const 0
         f32.lt
         br_if $assembly/math/clamp255|inlined.4
         drop
         i32.const 255
         local.get $4
         f32.const 255
         f32.gt
         br_if $assembly/math/clamp255|inlined.4
         drop
         local.get $4
         i32.trunc_sat_f32_u
        end
        i32.const 255
        i32.and
        i32.add
        i32.load8_u
        f32.convert_i32_u
        local.set $4
        local.get $21
        block $assembly/math/clamp255|inlined.5 (result i32)
         i32.const 0
         local.get $7
         local.get $7
         f32.ne
         br_if $assembly/math/clamp255|inlined.5
         drop
         i32.const 0
         local.get $7
         f32.const 0
         f32.lt
         br_if $assembly/math/clamp255|inlined.5
         drop
         i32.const 255
         local.get $7
         f32.const 255
         f32.gt
         br_if $assembly/math/clamp255|inlined.5
         drop
         local.get $7
         i32.trunc_sat_f32_u
        end
        i32.const 255
        i32.and
        i32.add
        i32.load8_u
        f32.convert_i32_u
        local.set $7
       end
       local.get $20
       if
        f32.const 0
        local.get $3
        f32.const 255
        f32.div
        local.tee $10
        f64.promote_f32
        local.tee $30
        local.get $4
        f32.const 255
        f32.div
        local.tee $9
        f64.promote_f32
        local.tee $29
        local.get $7
        f32.const 255
        f32.div
        local.tee $8
        f64.promote_f32
        local.tee $28
        f64.max
        f32.demote_f64
        f64.promote_f32
        f64.max
        f32.demote_f64
        local.tee $7
        local.get $28
        local.get $29
        f64.min
        f32.demote_f64
        f64.promote_f32
        local.get $30
        f64.min
        f32.demote_f64
        local.tee $4
        f32.sub
        local.tee $27
        local.get $7
        f32.div
        local.get $7
        f32.const 0
        f32.eq
        select
        local.set $3
        global.get $~lib/memory/__stack_pointer
        global.get $assembly/math/_hsv
        local.tee $2
        i32.store
        local.get $2
        local.get $4
        local.get $7
        f32.eq
        local.get $27
        f32.const 9.999999747378752e-06
        f32.lt
        i32.or
        if (result f32)
         f32.const 0
        else
         local.get $7
         local.get $10
         f32.eq
         if (result f32)
          local.get $9
          local.get $8
          f32.sub
          local.get $27
          f32.div
          f32.const 6
          f32.const 0
          local.get $8
          local.get $9
          f32.gt
          select
          f32.add
         else
          local.get $7
          local.get $9
          f32.eq
          if (result f32)
           local.get $8
           local.get $10
           f32.sub
           local.get $27
           f32.div
           f32.const 2
           f32.add
          else
           local.get $10
           local.get $9
           f32.sub
           local.get $27
           f32.div
           f32.const 4
           f32.add
          end
         end
         f32.const 6
         f32.div
        end
        f32.const 360
        f32.mul
        f32.store
        global.get $~lib/memory/__stack_pointer
        global.get $assembly/math/_hsv
        local.tee $2
        i32.store
        local.get $2
        local.get $3
        f32.const 100
        f32.mul
        f32.store offset=4
        global.get $~lib/memory/__stack_pointer
        global.get $assembly/math/_hsv
        local.tee $2
        i32.store
        local.get $2
        local.get $7
        f32.const 100
        f32.mul
        f32.store offset=8
        global.get $~lib/memory/__stack_pointer
        global.get $assembly/math/_hsv
        local.tee $26
        i32.store offset=4
        global.get $~lib/memory/__stack_pointer
        local.get $26
        i32.store
        local.get $20
        local.get $26
        f32.load
        local.tee $3
        f32.const 30
        f32.lt
        if (result i32)
         i32.const 1
         local.set $23
         f32.const 1
         local.get $3
         f32.const 30
         f32.div
         local.tee $3
         f32.sub
         local.set $4
         i32.const 0
        else
         local.get $3
         f32.const 60
         f32.lt
         if (result i32)
          i32.const 2
          local.set $23
          f32.const 1
          local.get $3
          f32.const -30
          f32.add
          f32.const 30
          f32.div
          local.tee $3
          f32.sub
          local.set $4
          i32.const 1
         else
          local.get $3
          f32.const 120
          f32.lt
          if (result i32)
           i32.const 3
           local.set $23
           f32.const 1
           local.get $3
           f32.const -60
           f32.add
           f32.const 60
           f32.div
           local.tee $3
           f32.sub
           local.set $4
           i32.const 2
          else
           local.get $3
           f32.const 180
           f32.lt
           if (result i32)
            i32.const 4
            local.set $23
            f32.const 1
            local.get $3
            f32.const -120
            f32.add
            f32.const 60
            f32.div
            local.tee $3
            f32.sub
            local.set $4
            i32.const 3
           else
            local.get $3
            f32.const 240
            f32.lt
            if (result i32)
             i32.const 5
             local.set $23
             f32.const 1
             local.get $3
             f32.const -180
             f32.add
             f32.const 60
             f32.div
             local.tee $3
             f32.sub
             local.set $4
             i32.const 4
            else
             local.get $3
             f32.const 280
             f32.lt
             if (result i32)
              i32.const 6
              local.set $23
              f32.const 1
              local.get $3
              f32.const -240
              f32.add
              f32.const 40
              f32.div
              local.tee $3
              f32.sub
              local.set $4
              i32.const 5
             else
              local.get $3
              f32.const 320
              f32.lt
              if (result i32)
               i32.const 7
               local.set $23
               f32.const 1
               local.get $3
               f32.const -280
               f32.add
               f32.const 40
               f32.div
               local.tee $3
               f32.sub
               local.set $4
               i32.const 6
              else
               i32.const 0
               local.set $23
               f32.const 1
               local.get $3
               f32.const -320
               f32.add
               f32.const 40
               f32.div
               local.tee $3
               f32.sub
               local.set $4
               i32.const 7
              end
             end
            end
           end
          end
         end
        end
        i32.const 12
        i32.mul
        i32.add
        local.tee $24
        f32.load
        local.get $4
        f32.mul
        local.get $20
        local.get $23
        i32.const 12
        i32.mul
        i32.add
        local.tee $2
        f32.load
        local.get $3
        f32.mul
        f32.add
        local.set $8
        local.get $24
        f32.load offset=4
        local.get $4
        f32.mul
        local.get $2
        f32.load offset=4
        local.get $3
        f32.mul
        f32.add
        local.set $7
        local.get $24
        f32.load offset=8
        local.get $4
        f32.mul
        local.get $2
        f32.load offset=8
        local.get $3
        f32.mul
        f32.add
        local.set $4
        global.get $~lib/memory/__stack_pointer
        local.get $26
        i32.store
        global.get $~lib/memory/__stack_pointer
        local.get $26
        i32.store offset=8
        local.get $26
        block $__inlined_func$~lib/math/NativeMathf.mod$4 (result f32)
         local.get $26
         f32.load
         local.get $8
         f32.add
         f32.const 3600
         f32.add
         local.tee $3
         i32.reinterpret_f32
         local.tee $25
         i32.const 23
         i32.shr_u
         i32.const 255
         i32.and
         local.tee $23
         i32.const 255
         i32.eq
         if
          local.get $3
          f32.const 360
          f32.mul
          local.tee $3
          local.get $3
          f32.div
          br $__inlined_func$~lib/math/NativeMathf.mod$4
         end
         local.get $25
         i32.const 1
         i32.shl
         local.tee $2
         i32.const -2023227392
         i32.le_u
         if
          local.get $3
          local.get $2
          i32.const -2023227392
          i32.ne
          f32.convert_i32_u
          f32.mul
          br $__inlined_func$~lib/math/NativeMathf.mod$4
         end
         local.get $25
         i32.const -2147483648
         i32.and
         local.set $24
         local.get $23
         if (result i32)
          local.get $25
          i32.const 8388607
          i32.and
          i32.const 8388608
          i32.or
         else
          local.get $25
          i32.const 1
          local.get $23
          local.get $25
          i32.const 9
          i32.shl
          i32.clz
          i32.sub
          local.tee $23
          i32.sub
          i32.shl
         end
         local.set $2
         loop $while-continue|0
          local.get $23
          i32.const 135
          i32.gt_s
          if
           local.get $2
           i32.const 11796480
           i32.ge_u
           if (result i32)
            local.get $3
            f32.const 0
            f32.mul
            local.get $2
            i32.const 11796480
            i32.eq
            br_if $__inlined_func$~lib/math/NativeMathf.mod$4
            drop
            local.get $2
            i32.const 11796480
            i32.sub
           else
            local.get $2
           end
           i32.const 1
           i32.shl
           local.set $2
           local.get $23
           i32.const 1
           i32.sub
           local.set $23
           br $while-continue|0
          end
         end
         local.get $2
         i32.const 11796480
         i32.ge_u
         if
          local.get $3
          f32.const 0
          f32.mul
          local.get $2
          i32.const 11796480
          i32.eq
          br_if $__inlined_func$~lib/math/NativeMathf.mod$4
          drop
          local.get $2
          i32.const 11796480
          i32.sub
          local.set $2
         end
         local.get $23
         local.get $2
         i32.const 8
         i32.shl
         i32.clz
         local.tee $23
         i32.sub
         local.set $25
         local.get $2
         local.get $23
         i32.shl
         local.set $2
         local.get $25
         i32.const 0
         i32.gt_s
         if (result i32)
          local.get $2
          i32.const 8388608
          i32.sub
          local.get $25
          i32.const 23
          i32.shl
          i32.or
         else
          local.get $2
          i32.const 1
          local.get $25
          i32.sub
          i32.shr_u
         end
         local.get $24
         i32.or
         f32.reinterpret_i32
        end
        f32.store
        global.get $~lib/memory/__stack_pointer
        local.get $26
        i32.store
        global.get $~lib/memory/__stack_pointer
        local.get $26
        i32.store offset=8
        local.get $26
        local.get $26
        f32.load offset=4
        local.get $7
        f32.add
        f64.promote_f32
        f64.const 100
        f64.min
        f64.const 0
        f64.max
        f32.demote_f64
        f32.store offset=4
        global.get $~lib/memory/__stack_pointer
        local.get $26
        i32.store
        global.get $~lib/memory/__stack_pointer
        local.get $26
        i32.store offset=8
        local.get $26
        local.get $26
        f32.load offset=8
        local.get $4
        f32.add
        f64.promote_f32
        f64.const 100
        f64.min
        f64.const 0
        f64.max
        f32.demote_f64
        f32.store offset=8
        global.get $~lib/memory/__stack_pointer
        local.get $26
        i32.store
        local.get $26
        f32.load
        global.get $~lib/memory/__stack_pointer
        local.get $26
        i32.store
        local.get $26
        f32.load offset=4
        f32.const 100
        f32.div
        local.set $4
        global.get $~lib/memory/__stack_pointer
        local.get $26
        i32.store
        local.get $26
        f32.load offset=8
        f32.const 100
        f32.div
        local.set $8
        f32.const 360
        f32.div
        local.tee $3
        f32.const 0
        f32.lt
        if
         f32.const 0
         local.set $3
        end
        f32.const 1
        local.get $3
        local.get $3
        f32.const 1
        f32.gt
        select
        f32.const 0
        local.get $4
        local.get $4
        f32.const 0
        f32.lt
        select
        local.tee $4
        f32.const 1
        f32.gt
        if
         f32.const 1
         local.set $4
        end
        f32.const 0
        local.get $8
        local.get $8
        f32.const 0
        f32.lt
        select
        local.tee $3
        f32.const 1
        f32.gt
        if
         f32.const 1
         local.set $3
        end
        local.get $3
        f32.const 1
        local.get $4
        f32.sub
        f32.mul
        local.set $8
        f32.const 6
        f32.mul
        local.tee $7
        f64.promote_f32
        f64.floor
        i32.trunc_sat_f64_s
        local.set $2
        local.get $3
        f32.const 1
        local.get $7
        local.get $2
        f32.convert_i32_s
        f32.sub
        local.tee $7
        local.get $4
        f32.mul
        f32.sub
        f32.mul
        local.set $10
        local.get $3
        f32.const 1
        f32.const 1
        local.get $7
        f32.sub
        local.get $4
        f32.mul
        f32.sub
        f32.mul
        local.set $9
        block $break|2
         block $case5|2
          block $case4|2
           block $case3|2
            block $case2|2
             block $case1|2
              block $case0|2
               local.get $2
               i32.const 6
               i32.rem_s
               br_table $case0|2 $case1|2 $case2|2 $case3|2 $case4|2 $case5|2
              end
              local.get $3
              local.set $4
              local.get $9
              local.set $7
              local.get $8
              local.set $3
              br $break|2
             end
             local.get $10
             local.set $4
             local.get $3
             local.set $7
             local.get $8
             local.set $3
             br $break|2
            end
            local.get $8
            local.set $4
            local.get $3
            local.set $7
            local.get $9
            local.set $3
            br $break|2
           end
           local.get $8
           local.set $4
           local.get $10
           local.set $7
           br $break|2
          end
          local.get $9
          local.set $4
          local.get $8
          local.set $7
          br $break|2
         end
         local.get $3
         local.set $4
         local.get $8
         local.set $7
         local.get $10
         local.set $3
        end
        global.get $~lib/memory/__stack_pointer
        global.get $assembly/math/_rgb
        local.tee $2
        i32.store
        local.get $2
        local.get $4
        f32.const 255
        f32.mul
        f32.store
        global.get $~lib/memory/__stack_pointer
        global.get $assembly/math/_rgb
        local.tee $2
        i32.store
        local.get $2
        local.get $7
        f32.const 255
        f32.mul
        f32.store offset=4
        global.get $~lib/memory/__stack_pointer
        global.get $assembly/math/_rgb
        local.tee $2
        i32.store
        local.get $2
        local.get $3
        f32.const 255
        f32.mul
        f32.store offset=8
        global.get $~lib/memory/__stack_pointer
        global.get $assembly/math/_rgb
        local.tee $2
        i32.store offset=12
        global.get $~lib/memory/__stack_pointer
        local.get $2
        i32.store
        local.get $2
        f32.load
        local.set $3
        global.get $~lib/memory/__stack_pointer
        local.get $2
        i32.store
        local.get $2
        f32.load offset=4
        local.set $4
        global.get $~lib/memory/__stack_pointer
        local.get $2
        i32.store
        local.get $2
        f32.load offset=8
        local.set $7
       end
       local.get $43
       f32.const 1
       f32.ne
       local.get $36
       f32.const 0
       f32.ne
       i32.or
       if
        local.get $3
        f64.promote_f32
        local.get $4
        f64.promote_f32
        local.get $7
        f64.promote_f32
        f64.max
        f32.demote_f64
        f64.promote_f32
        f64.max
        f32.demote_f64
        local.tee $10
        local.get $3
        local.get $4
        f32.add
        local.get $7
        f32.add
        f32.const 3
        f32.div
        f32.sub
        f32.const 255
        f32.div
        local.get $36
        f32.mul
        local.set $9
        local.get $3
        local.get $10
        local.get $3
        f32.sub
        local.get $9
        f32.mul
        f32.add
        local.tee $3
        f32.const 0.29899999499320984
        f32.mul
        local.get $4
        local.get $10
        local.get $4
        f32.sub
        local.get $9
        f32.mul
        f32.add
        local.tee $8
        f32.const 0.5870000123977661
        f32.mul
        f32.add
        local.get $7
        local.get $10
        local.get $7
        f32.sub
        local.get $9
        f32.mul
        f32.add
        local.tee $7
        f32.const 0.11400000005960464
        f32.mul
        f32.add
        local.tee $4
        local.get $3
        local.get $4
        f32.sub
        local.get $43
        f32.mul
        f32.add
        local.set $3
        local.get $4
        local.get $7
        local.get $4
        f32.sub
        local.get $43
        f32.mul
        f32.add
        local.set $7
        local.get $4
        local.get $8
        local.get $4
        f32.sub
        local.get $43
        f32.mul
        f32.add
        local.set $4
       end
       local.get $0
       local.get $37
       i32.add
       block $assembly/math/clamp255|inlined.6 (result i32)
        i32.const 0
        local.get $3
        local.get $3
        f32.ne
        br_if $assembly/math/clamp255|inlined.6
        drop
        i32.const 0
        local.get $3
        f32.const 0
        f32.lt
        br_if $assembly/math/clamp255|inlined.6
        drop
        i32.const 255
        local.get $3
        f32.const 255
        f32.gt
        br_if $assembly/math/clamp255|inlined.6
        drop
        local.get $3
        i32.trunc_sat_f32_u
       end
       i32.store8
       local.get $0
       local.get $37
       i32.add
       block $assembly/math/clamp255|inlined.7 (result i32)
        i32.const 0
        local.get $4
        local.get $4
        f32.ne
        br_if $assembly/math/clamp255|inlined.7
        drop
        i32.const 0
        local.get $4
        f32.const 0
        f32.lt
        br_if $assembly/math/clamp255|inlined.7
        drop
        i32.const 255
        local.get $4
        f32.const 255
        f32.gt
        br_if $assembly/math/clamp255|inlined.7
        drop
        local.get $4
        i32.trunc_sat_f32_u
       end
       i32.store8 offset=1
       local.get $0
       local.get $37
       i32.add
       block $assembly/math/clamp255|inlined.8 (result i32)
        i32.const 0
        local.get $7
        local.get $7
        f32.ne
        br_if $assembly/math/clamp255|inlined.8
        drop
        i32.const 0
        local.get $7
        f32.const 0
        f32.lt
        br_if $assembly/math/clamp255|inlined.8
        drop
        i32.const 255
        local.get $7
        f32.const 255
        f32.gt
        br_if $assembly/math/clamp255|inlined.8
        drop
        local.get $7
        i32.trunc_sat_f32_u
       end
       i32.store8 offset=2
      end
      local.get $42
      i32.const 1
      i32.add
      local.set $42
      br $for-loop|1
     end
    end
    local.get $22
    i32.const 1
    i32.add
    local.set $22
    br $for-loop|0
   end
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $assembly/filters/orderedDither (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 f32)
  (local $10 i32)
  (local $11 i32)
  (local $12 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  block $folding-inner0
   global.get $~lib/memory/__stack_pointer
   i32.const 8672
   i32.lt_s
   br_if $folding-inner0
   global.get $~lib/memory/__stack_pointer
   i64.const 0
   i64.store
   i32.const 1
   local.get $3
   local.get $3
   i32.const 0
   i32.le_s
   select
   local.set $2
   loop $for-loop|0
    local.get $5
    local.get $6
    i32.lt_s
    if
     local.get $1
     local.get $5
     i32.mul
     i32.const 2
     i32.shl
     local.set $7
     local.get $5
     local.get $2
     i32.div_s
     i32.const 8
     i32.rem_s
     local.set $8
     i32.const 0
     local.set $3
     loop $for-loop|1
      local.get $1
      local.get $3
      i32.gt_s
      if
       block $for-continue|1
        local.get $7
        local.get $3
        i32.const 2
        i32.shl
        i32.add
        local.tee $10
        local.get $0
        i32.add
        local.tee $11
        i32.load8_u offset=3
        i32.const 128
        i32.lt_u
        if
         local.get $11
         i32.const 0
         i32.store
         br $for-continue|1
        end
        local.get $3
        local.get $2
        i32.div_s
        i32.const 8
        i32.rem_s
        local.set $11
        local.get $0
        local.get $10
        i32.add
        local.tee $10
        i32.load8_u
        f32.convert_i32_u
        f32.const 0.29899999499320984
        f32.mul
        local.get $10
        i32.load8_u offset=1
        f32.convert_i32_u
        f32.const 0.5870000123977661
        f32.mul
        f32.add
        local.get $10
        i32.load8_u offset=2
        f32.convert_i32_u
        f32.const 0.11400000005960464
        f32.mul
        f32.add
        local.set $9
        global.get $~lib/memory/__stack_pointer
        global.get $assembly/filters/BAYER_MATRIX
        local.tee $12
        i32.store offset=4
        global.get $~lib/memory/__stack_pointer
        i32.const 4
        i32.sub
        global.set $~lib/memory/__stack_pointer
        global.get $~lib/memory/__stack_pointer
        i32.const 8672
        i32.lt_s
        br_if $folding-inner0
        global.get $~lib/memory/__stack_pointer
        i32.const 0
        i32.store
        global.get $~lib/memory/__stack_pointer
        local.get $12
        i32.store
        local.get $12
        i32.load offset=4
        local.get $8
        i32.const 2
        i32.shl
        i32.add
        i32.load
        local.set $12
        global.get $~lib/memory/__stack_pointer
        i32.const 4
        i32.add
        global.set $~lib/memory/__stack_pointer
        global.get $~lib/memory/__stack_pointer
        local.get $12
        i32.store
        global.get $~lib/memory/__stack_pointer
        i32.const 4
        i32.sub
        global.set $~lib/memory/__stack_pointer
        global.get $~lib/memory/__stack_pointer
        i32.const 8672
        i32.lt_s
        br_if $folding-inner0
        global.get $~lib/memory/__stack_pointer
        i32.const 0
        i32.store
        global.get $~lib/memory/__stack_pointer
        local.get $12
        i32.store
        local.get $12
        i32.load offset=4
        local.get $11
        i32.const 2
        i32.shl
        i32.add
        i32.load
        local.set $11
        global.get $~lib/memory/__stack_pointer
        i32.const 4
        i32.add
        global.set $~lib/memory/__stack_pointer
        local.get $10
        i32.const 255
        i32.const 255
        i32.const 0
        local.get $9
        local.get $11
        f32.convert_i32_s
        f32.const 4
        f32.mul
        f32.ge
        select
        local.tee $10
        i32.sub
        local.get $10
        local.get $4
        select
        i32.const 255
        i32.and
        local.tee $10
        local.get $10
        i32.const 8
        i32.shl
        i32.or
        local.get $10
        i32.const 16
        i32.shl
        i32.or
        i32.const -16777216
        i32.or
        i32.store
       end
       local.get $3
       i32.const 1
       i32.add
       local.set $3
       br $for-loop|1
      end
     end
     local.get $5
     i32.const 1
     i32.add
     local.set $5
     br $for-loop|0
    end
   end
   global.get $~lib/memory/__stack_pointer
   i32.const 8
   i32.add
   global.set $~lib/memory/__stack_pointer
   return
  end
  i32.const 41472
  i32.const 41520
  i32.const 1
  i32.const 1
  call $~lib/builtins/abort
  unreachable
 )
 (func $~lib/typedarray/Int32Array#constructor (param $0 i32) (result i32)
  (local $1 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 8672
  i32.lt_s
  if
   i32.const 41472
   i32.const 41520
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.const 9
  call $~lib/rt/itcms/__new
  local.tee $1
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  global.get $~lib/memory/__stack_pointer
  local.get $1
  local.get $0
  i32.const 2
  call $~lib/arraybuffer/ArrayBufferView#constructor
  local.tee $0
  i32.store
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $0
 )
 (func $~lib/typedarray/Int32Array#__set (param $0 i32) (param $1 i32) (param $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 8672
  i32.lt_s
  if
   i32.const 41472
   i32.const 41520
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $1
  local.get $0
  i32.load offset=8
  i32.const 2
  i32.shr_u
  i32.ge_u
  if
   i32.const 1248
   i32.const 8480
   i32.const 747
   i32.const 64
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $0
  i32.load offset=4
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  local.get $2
  i32.store
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/typedarray/Uint8Array#__set (param $0 i32) (param $1 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 8672
  i32.lt_s
  if
   i32.const 41472
   i32.const 41520
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $1
  local.get $0
  i32.load offset=8
  i32.ge_u
  if
   i32.const 1248
   i32.const 8480
   i32.const 178
   i32.const 45
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $1
  local.get $0
  i32.load offset=4
  i32.add
  i32.const 1
  i32.store8
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/typedarray/Int32Array#__get (param $0 i32) (param $1 i32) (result i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 8672
  i32.lt_s
  if
   i32.const 41472
   i32.const 41520
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $1
  local.get $0
  i32.load offset=8
  i32.const 2
  i32.shr_u
  i32.ge_u
  if
   i32.const 1248
   i32.const 8480
   i32.const 736
   i32.const 64
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $0
  i32.load offset=4
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  i32.load
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/array/Array<i32>#__get (param $0 i32) (param $1 i32) (result i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 8672
  i32.lt_s
  if
   i32.const 41472
   i32.const 41520
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $1
  local.get $0
  i32.load offset=12
  i32.ge_u
  if
   i32.const 1248
   i32.const 1968
   i32.const 114
   i32.const 42
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $0
  i32.load offset=4
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  i32.load
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $assembly/filters/magicWand (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32) (param $8 i32) (param $9 i32) (param $10 f32)
  (local $11 i32)
  (local $12 i32)
  (local $13 i32)
  (local $14 i32)
  (local $15 i32)
  (local $16 i32)
  (local $17 i32)
  (local $18 i32)
  (local $19 i32)
  (local $20 i32)
  (local $21 f32)
  global.get $~lib/memory/__stack_pointer
  i32.const 20
  i32.sub
  global.set $~lib/memory/__stack_pointer
  block $folding-inner0
   global.get $~lib/memory/__stack_pointer
   i32.const 8672
   i32.lt_s
   br_if $folding-inner0
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.const 20
   memory.fill
   local.get $10
   local.get $10
   f32.mul
   local.set $10
   global.get $~lib/memory/__stack_pointer
   local.get $2
   local.get $3
   i32.mul
   local.tee $12
   call $~lib/typedarray/Uint8Array#constructor
   local.tee $11
   i32.store
   global.get $~lib/memory/__stack_pointer
   local.get $12
   i32.const 1
   i32.shl
   call $~lib/typedarray/Int32Array#constructor
   local.tee $18
   i32.store offset=4
   global.get $~lib/memory/__stack_pointer
   local.get $18
   i32.store offset=8
   local.get $18
   i32.const 0
   local.get $4
   call $~lib/typedarray/Int32Array#__set
   global.get $~lib/memory/__stack_pointer
   local.get $18
   i32.store offset=8
   i32.const 2
   local.set $12
   local.get $18
   i32.const 1
   local.get $5
   call $~lib/typedarray/Int32Array#__set
   global.get $~lib/memory/__stack_pointer
   local.get $11
   i32.store offset=8
   local.get $11
   local.get $2
   local.get $5
   i32.mul
   local.tee $5
   local.get $4
   i32.add
   call $~lib/typedarray/Uint8Array#__set
   local.get $1
   local.get $5
   i32.add
   local.get $4
   i32.add
   i32.const 1
   i32.store8
   loop $while-continue|0
    local.get $12
    i32.const 0
    i32.gt_s
    if
     global.get $~lib/memory/__stack_pointer
     local.get $18
     i32.store offset=8
     local.get $18
     local.get $12
     i32.const 1
     i32.sub
     local.tee $4
     call $~lib/typedarray/Int32Array#__get
     local.set $16
     global.get $~lib/memory/__stack_pointer
     local.get $18
     i32.store offset=8
     local.get $18
     local.get $4
     i32.const 1
     i32.sub
     local.tee $12
     call $~lib/typedarray/Int32Array#__get
     local.set $17
     global.get $~lib/memory/__stack_pointer
     i32.const 4
     i32.const 6
     i32.const 8544
     call $~lib/rt/__newArray
     local.tee $14
     i32.store offset=12
     global.get $~lib/memory/__stack_pointer
     i32.const 4
     i32.const 6
     i32.const 8592
     call $~lib/rt/__newArray
     local.tee $15
     i32.store offset=16
     i32.const 0
     local.set $5
     loop $for-loop|1
      local.get $5
      i32.const 4
      i32.lt_s
      if
       global.get $~lib/memory/__stack_pointer
       local.get $14
       i32.store offset=8
       local.get $14
       local.get $5
       call $~lib/array/Array<i32>#__get
       local.get $17
       i32.add
       local.set $4
       global.get $~lib/memory/__stack_pointer
       local.get $15
       i32.store offset=8
       local.get $2
       local.get $4
       i32.gt_s
       local.get $4
       i32.const 0
       i32.ge_s
       i32.and
       local.get $15
       local.get $5
       call $~lib/array/Array<i32>#__get
       local.get $16
       i32.add
       local.tee $13
       i32.const 0
       i32.ge_s
       i32.and
       local.get $3
       local.get $13
       i32.gt_s
       i32.and
       if
        global.get $~lib/memory/__stack_pointer
        local.get $11
        i32.store offset=8
        global.get $~lib/memory/__stack_pointer
        i32.const 4
        i32.sub
        global.set $~lib/memory/__stack_pointer
        global.get $~lib/memory/__stack_pointer
        i32.const 8672
        i32.lt_s
        br_if $folding-inner0
        global.get $~lib/memory/__stack_pointer
        i32.const 0
        i32.store
        global.get $~lib/memory/__stack_pointer
        local.get $11
        i32.store
        local.get $2
        local.get $13
        i32.mul
        local.get $4
        i32.add
        local.tee $19
        local.get $11
        i32.load offset=8
        i32.ge_u
        if
         i32.const 1248
         i32.const 8480
         i32.const 167
         i32.const 45
         call $~lib/builtins/abort
         unreachable
        end
        global.get $~lib/memory/__stack_pointer
        local.get $11
        i32.store
        local.get $19
        local.get $11
        i32.load offset=4
        i32.add
        i32.load8_u
        global.get $~lib/memory/__stack_pointer
        i32.const 4
        i32.add
        global.set $~lib/memory/__stack_pointer
        i32.eqz
        if
         global.get $~lib/memory/__stack_pointer
         local.get $11
         i32.store offset=8
         local.get $11
         local.get $19
         call $~lib/typedarray/Uint8Array#__set
         local.get $19
         i32.const 2
         i32.shl
         local.get $0
         i32.add
         local.tee $20
         i32.load8_u
         f32.convert_i32_u
         local.get $6
         i32.const 255
         i32.and
         f32.convert_i32_u
         f32.sub
         local.tee $21
         local.get $21
         f32.mul
         local.get $20
         i32.load8_u offset=1
         f32.convert_i32_u
         local.get $7
         i32.const 255
         i32.and
         f32.convert_i32_u
         f32.sub
         local.tee $21
         local.get $21
         f32.mul
         f32.add
         local.get $20
         i32.load8_u offset=2
         f32.convert_i32_u
         local.get $8
         i32.const 255
         i32.and
         f32.convert_i32_u
         f32.sub
         local.tee $21
         local.get $21
         f32.mul
         f32.add
         local.get $20
         i32.load8_u offset=3
         f32.convert_i32_u
         local.get $9
         i32.const 255
         i32.and
         f32.convert_i32_u
         f32.sub
         local.tee $21
         local.get $21
         f32.mul
         f32.add
         local.get $10
         f32.le
         if
          local.get $1
          local.get $19
          i32.add
          i32.const 1
          i32.store8
          global.get $~lib/memory/__stack_pointer
          local.get $18
          i32.store offset=8
          local.get $18
          local.get $12
          local.get $4
          call $~lib/typedarray/Int32Array#__set
          global.get $~lib/memory/__stack_pointer
          local.get $18
          i32.store offset=8
          local.get $12
          i32.const 1
          i32.add
          local.tee $4
          i32.const 1
          i32.add
          local.set $12
          local.get $18
          local.get $4
          local.get $13
          call $~lib/typedarray/Int32Array#__set
         end
        end
       end
       local.get $5
       i32.const 1
       i32.add
       local.set $5
       br $for-loop|1
      end
     end
     br $while-continue|0
    end
   end
   global.get $~lib/memory/__stack_pointer
   i32.const 20
   i32.add
   global.set $~lib/memory/__stack_pointer
   return
  end
  i32.const 41472
  i32.const 41520
  i32.const 1
  i32.const 1
  call $~lib/builtins/abort
  unreachable
 )
 (func $~lib/typedarray/Uint32Array#constructor (param $0 i32) (result i32)
  (local $1 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 8672
  i32.lt_s
  if
   i32.const 41472
   i32.const 41520
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i32.const 12
  i32.const 10
  call $~lib/rt/itcms/__new
  local.tee $1
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  global.get $~lib/memory/__stack_pointer
  local.get $1
  local.get $0
  i32.const 2
  call $~lib/arraybuffer/ArrayBufferView#constructor
  local.tee $0
  i32.store
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $0
 )
 (func $~lib/typedarray/Uint32Array#__set (param $0 i32) (param $1 i32) (param $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 8672
  i32.lt_s
  if
   i32.const 41472
   i32.const 41520
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $1
  local.get $0
  i32.load offset=8
  i32.const 2
  i32.shr_u
  i32.ge_u
  if
   i32.const 1248
   i32.const 8480
   i32.const 889
   i32.const 64
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $0
  i32.load offset=4
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  local.get $2
  i32.store
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/typedarray/Uint32Array#__get (param $0 i32) (param $1 i32) (result i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 8672
  i32.lt_s
  if
   i32.const 41472
   i32.const 41520
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $1
  local.get $0
  i32.load offset=8
  i32.const 2
  i32.shr_u
  i32.ge_u
  if
   i32.const 1248
   i32.const 8480
   i32.const 878
   i32.const 64
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.store
  local.get $0
  i32.load offset=4
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  i32.load
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $assembly/pdn_effects/oilPainting (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32)
  (local $8 i32)
  (local $9 f64)
  (local $10 f64)
  (local $11 f64)
  (local $12 f64)
  (local $13 i32)
  (local $14 i32)
  (local $15 i32)
  (local $16 i32)
  (local $17 i32)
  (local $18 f64)
  (local $19 f64)
  (local $20 i32)
  (local $21 i32)
  (local $22 i32)
  (local $23 i32)
  (local $24 i32)
  (local $25 i32)
  (local $26 i32)
  (local $27 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 28
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 8672
  i32.lt_s
  if
   i32.const 41472
   i32.const 41520
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.const 28
  memory.fill
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.const 1
  i32.add
  local.tee $21
  call $~lib/typedarray/Int32Array#constructor
  local.tee $27
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $21
  call $~lib/typedarray/Uint32Array#constructor
  local.tee $26
  i32.store offset=4
  global.get $~lib/memory/__stack_pointer
  local.get $21
  call $~lib/typedarray/Uint32Array#constructor
  local.tee $25
  i32.store offset=8
  global.get $~lib/memory/__stack_pointer
  local.get $21
  call $~lib/typedarray/Uint32Array#constructor
  local.tee $24
  i32.store offset=12
  global.get $~lib/memory/__stack_pointer
  local.get $21
  call $~lib/typedarray/Uint32Array#constructor
  local.tee $23
  i32.store offset=16
  local.get $6
  local.set $13
  loop $for-loop|0
   local.get $7
   local.get $13
   i32.gt_s
   if
    local.get $2
    local.get $13
    i32.mul
    i32.const 2
    i32.shl
    local.set $20
    local.get $13
    local.get $4
    i32.sub
    f64.convert_i32_s
    f64.const 0
    f64.max
    local.set $10
    local.get $3
    f64.convert_i32_s
    local.get $4
    local.get $13
    i32.add
    i32.const 1
    i32.add
    f64.convert_i32_s
    f64.min
    local.set $19
    i32.const 0
    local.set $22
    loop $for-loop|1
     local.get $2
     local.get $22
     i32.gt_s
     if
      local.get $22
      local.get $4
      i32.sub
      f64.convert_i32_s
      f64.const 0
      f64.max
      local.set $9
      local.get $2
      f64.convert_i32_s
      local.get $4
      local.get $22
      i32.add
      i32.const 1
      i32.add
      f64.convert_i32_s
      f64.min
      local.set $18
      i32.const 0
      local.set $6
      loop $for-loop|2
       local.get $6
       local.get $21
       i32.lt_s
       if
        global.get $~lib/memory/__stack_pointer
        local.get $27
        i32.store offset=20
        local.get $27
        local.get $6
        i32.const 0
        call $~lib/typedarray/Int32Array#__set
        global.get $~lib/memory/__stack_pointer
        local.get $26
        i32.store offset=20
        local.get $26
        local.get $6
        i32.const 0
        call $~lib/typedarray/Uint32Array#__set
        global.get $~lib/memory/__stack_pointer
        local.get $25
        i32.store offset=20
        local.get $25
        local.get $6
        i32.const 0
        call $~lib/typedarray/Uint32Array#__set
        global.get $~lib/memory/__stack_pointer
        local.get $24
        i32.store offset=20
        local.get $24
        local.get $6
        i32.const 0
        call $~lib/typedarray/Uint32Array#__set
        global.get $~lib/memory/__stack_pointer
        local.get $23
        i32.store offset=20
        local.get $23
        local.get $6
        i32.const 0
        call $~lib/typedarray/Uint32Array#__set
        local.get $6
        i32.const 1
        i32.add
        local.set $6
        br $for-loop|2
       end
      end
      local.get $10
      local.set $12
      loop $for-loop|3
       local.get $12
       local.get $19
       f64.lt
       if
        local.get $12
        i32.trunc_sat_f64_u
        local.get $2
        i32.mul
        i32.const 2
        i32.shl
        local.set $14
        local.get $9
        local.set $11
        loop $for-loop|4
         local.get $11
         local.get $18
         f64.lt
         if
          local.get $14
          local.get $11
          i32.trunc_sat_f64_u
          i32.const 2
          i32.shl
          i32.add
          local.get $0
          i32.add
          local.tee $6
          i32.load8_u
          local.set $17
          local.get $6
          i32.load8_u offset=3
          local.set $8
          local.get $17
          i32.const 77
          i32.mul
          local.get $6
          i32.load8_u offset=1
          local.tee $16
          i32.const 150
          i32.mul
          i32.add
          local.get $6
          i32.load8_u offset=2
          local.tee $6
          i32.const 29
          i32.mul
          i32.add
          i32.const 255
          i32.and
          f32.convert_i32_u
          f32.const 0.00390625
          f32.mul
          local.get $5
          f32.convert_i32_s
          f32.const 255
          f32.div
          f32.mul
          i32.trunc_sat_f32_s
          local.set $15
          global.get $~lib/memory/__stack_pointer
          local.get $27
          i32.store offset=20
          global.get $~lib/memory/__stack_pointer
          local.get $27
          i32.store offset=24
          local.get $27
          local.get $15
          local.get $27
          local.get $15
          call $~lib/typedarray/Int32Array#__get
          i32.const 1
          i32.add
          call $~lib/typedarray/Int32Array#__set
          global.get $~lib/memory/__stack_pointer
          local.get $26
          i32.store offset=20
          global.get $~lib/memory/__stack_pointer
          local.get $26
          i32.store offset=24
          local.get $26
          local.get $15
          local.get $26
          local.get $15
          call $~lib/typedarray/Uint32Array#__get
          local.get $17
          i32.add
          call $~lib/typedarray/Uint32Array#__set
          global.get $~lib/memory/__stack_pointer
          local.get $25
          i32.store offset=20
          global.get $~lib/memory/__stack_pointer
          local.get $25
          i32.store offset=24
          local.get $25
          local.get $15
          local.get $25
          local.get $15
          call $~lib/typedarray/Uint32Array#__get
          local.get $16
          i32.add
          call $~lib/typedarray/Uint32Array#__set
          global.get $~lib/memory/__stack_pointer
          local.get $24
          i32.store offset=20
          global.get $~lib/memory/__stack_pointer
          local.get $24
          i32.store offset=24
          local.get $24
          local.get $15
          local.get $24
          local.get $15
          call $~lib/typedarray/Uint32Array#__get
          local.get $6
          i32.add
          call $~lib/typedarray/Uint32Array#__set
          global.get $~lib/memory/__stack_pointer
          local.get $23
          i32.store offset=20
          global.get $~lib/memory/__stack_pointer
          local.get $23
          i32.store offset=24
          local.get $23
          local.get $15
          local.get $23
          local.get $15
          call $~lib/typedarray/Uint32Array#__get
          local.get $8
          i32.add
          call $~lib/typedarray/Uint32Array#__set
          local.get $11
          f64.const 1
          f64.add
          local.set $11
          br $for-loop|4
         end
        end
        local.get $12
        f64.const 1
        f64.add
        local.set $12
        br $for-loop|3
       end
      end
      i32.const 0
      local.set $8
      i32.const 0
      local.set $14
      i32.const 0
      local.set $6
      loop $for-loop|5
       local.get $5
       local.get $6
       i32.ge_s
       if
        global.get $~lib/memory/__stack_pointer
        local.get $27
        i32.store offset=20
        local.get $27
        local.get $6
        call $~lib/typedarray/Int32Array#__get
        local.get $14
        i32.gt_s
        if
         global.get $~lib/memory/__stack_pointer
         local.get $27
         i32.store offset=20
         local.get $27
         local.get $6
         call $~lib/typedarray/Int32Array#__get
         local.set $14
         local.get $6
         local.set $8
        end
        local.get $6
        i32.const 1
        i32.add
        local.set $6
        br $for-loop|5
       end
      end
      local.get $20
      local.get $22
      i32.const 2
      i32.shl
      i32.add
      local.set $6
      local.get $14
      i32.const 0
      i32.gt_s
      if
       global.get $~lib/memory/__stack_pointer
       local.get $26
       i32.store offset=20
       local.get $1
       local.get $6
       i32.add
       local.tee $6
       local.get $26
       local.get $8
       call $~lib/typedarray/Uint32Array#__get
       local.get $14
       i32.div_u
       i32.store8
       global.get $~lib/memory/__stack_pointer
       local.get $25
       i32.store offset=20
       local.get $6
       local.get $25
       local.get $8
       call $~lib/typedarray/Uint32Array#__get
       local.get $14
       i32.div_u
       i32.store8 offset=1
       global.get $~lib/memory/__stack_pointer
       local.get $24
       i32.store offset=20
       local.get $6
       local.get $24
       local.get $8
       call $~lib/typedarray/Uint32Array#__get
       local.get $14
       i32.div_u
       i32.store8 offset=2
       global.get $~lib/memory/__stack_pointer
       local.get $23
       i32.store offset=20
       local.get $6
       local.get $23
       local.get $8
       call $~lib/typedarray/Uint32Array#__get
       local.get $14
       i32.div_u
       i32.store8 offset=3
      else
       local.get $1
       local.get $6
       i32.add
       local.tee $8
       local.get $0
       local.get $6
       i32.add
       local.tee $6
       i32.load8_u
       i32.store8
       local.get $8
       local.get $6
       i32.load8_u offset=1
       i32.store8 offset=1
       local.get $8
       local.get $6
       i32.load8_u offset=2
       i32.store8 offset=2
       local.get $8
       local.get $6
       i32.load8_u offset=3
       i32.store8 offset=3
      end
      local.get $22
      i32.const 1
      i32.add
      local.set $22
      br $for-loop|1
     end
    end
    local.get $13
    i32.const 1
    i32.add
    local.set $13
    br $for-loop|0
   end
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 28
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/object/Object#constructor (param $0 i32) (result i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 8672
  i32.lt_s
  if
   i32.const 41472
   i32.const 41520
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $0
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.const 0
   call $~lib/rt/itcms/__new
   local.tee $0
   i32.store
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $0
 )
 (func $~lib/rt/__newArray (param $0 i32) (param $1 i32) (param $2 i32) (result i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  global.get $~lib/memory/__stack_pointer
  i32.const 8672
  i32.lt_s
  if
   i32.const 41472
   i32.const 41520
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  local.get $0
  i32.const 2
  i32.shl
  local.tee $4
  i32.const 1
  call $~lib/rt/itcms/__new
  local.set $3
  local.get $2
  if
   local.get $3
   local.get $2
   local.get $4
   memory.copy
  end
  local.get $3
  i32.store
  i32.const 16
  local.get $1
  call $~lib/rt/itcms/__new
  local.tee $1
  local.get $3
  i32.store
  local.get $1
  local.get $3
  i32.const 0
  call $~lib/rt/itcms/__link
  local.get $1
  local.get $3
  i32.store offset=4
  local.get $1
  local.get $4
  i32.store offset=8
  local.get $1
  local.get $0
  i32.store offset=12
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
)
