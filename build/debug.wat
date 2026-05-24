(module
 (type $0 (func (param i32) (result i32)))
 (type $1 (func (param i32 i32)))
 (type $2 (func (param i32 i32) (result i32)))
 (type $3 (func))
 (type $4 (func (param i32)))
 (type $5 (func (param i32 i32 i32)))
 (type $6 (func (param i32 f32)))
 (type $7 (func (param i32) (result f32)))
 (type $8 (func (param i32 i32 i32 i32 f32 i32 i32)))
 (type $9 (func (param i32 i32 i32 i32 i32 i32 i32)))
 (type $10 (func (param i32 i32 i32 i32)))
 (type $11 (func (param f64) (result f64)))
 (type $12 (func (param i32 i32 i32 f32 f32 i32 i32)))
 (type $13 (func (param i32 i32 i32 i32 i32)))
 (type $14 (func (param i32 i32 i32 f32 i32 i32)))
 (type $15 (func (param i32 i32 i32) (result i32)))
 (type $16 (func (param f64 f64) (result f64)))
 (type $17 (func (param i32 i32 i32 i32 i32 i32)))
 (type $18 (func (param i32 i32 i32 i32 i32 i32 i32 i32)))
 (type $19 (func (param i32 i32 i32 i32 i32 i32 i32 i32 f32)))
 (type $20 (func (param i32 i32 i64) (result i32)))
 (type $21 (func (result i32)))
 (type $22 (func (param f32 f32) (result f32)))
 (type $23 (func (param f64 i64) (result i32)))
 (type $24 (func (param i32 i32 i32 i32 f32 f32 i32 i32)))
 (type $25 (func (param i32 i32 i32 f32 i32 i32 i32 i32 i32 i32)))
 (type $26 (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)))
 (type $27 (func (param i32 i32 i32 i32 i32 i32 i32 i32 f32 f32)))
 (type $28 (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
 (type $29 (func (param f32 f32 f32 f32) (result f32)))
 (type $30 (func (param f32 f32 f32 f32 f32 f32) (result f32)))
 (type $31 (func (param f32 f32 f32 f32 f32 f32 f32) (result i32)))
 (type $32 (func (param f32 f32 f32 f32 f32 f32 f32 f32 f32) (result f32)))
 (type $33 (func (result f64)))
 (type $34 (func (param i32 i32 i32 i32 f32 f32 i32 i32 i32)))
 (type $35 (func (param i32 i32 i32 i32 i32 f32 i32 i32)))
 (type $36 (func (param i32 i32 i32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 f32 i32 i32 i32 i32)))
 (type $37 (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 f32)))
 (type $38 (func (param i32 i32 i32 i32) (result i32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (global $~lib/rt/itcms/total (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/threshold (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/state (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/visitCount (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/pinSpace (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/iter (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/toSpace (mut i32) (i32.const 0))
 (global $~lib/rt/itcms/white (mut i32) (i32.const 0))
 (global $~lib/shared/runtime/Runtime.Stub i32 (i32.const 0))
 (global $~lib/shared/runtime/Runtime.Minimal i32 (i32.const 1))
 (global $~lib/shared/runtime/Runtime.Incremental i32 (i32.const 2))
 (global $~lib/rt/itcms/fromSpace (mut i32) (i32.const 0))
 (global $~lib/rt/tlsf/ROOT (mut i32) (i32.const 0))
 (global $~lib/native/ASC_LOW_MEMORY_LIMIT i32 (i32.const 0))
 (global $assembly/math/_hsv (mut i32) (i32.const 0))
 (global $assembly/math/_rgb (mut i32) (i32.const 0))
 (global $~lib/native/ASC_RUNTIME i32 (i32.const 2))
 (global $assembly/filters/BAYER_MATRIX (mut i32) (i32.const 0))
 (global $assembly/pdn_effects/seed (mut i32) (i32.const 12345))
 (global $assembly/index/ALPHA_ARRAY_ID i32 (i32.const 8))
 (global $~lib/native/ASC_SHRINK_LEVEL i32 (i32.const 0))
 (global $~lib/util/math/log_tail (mut f64) (f64.const 0))
 (global $~lib/math/NativeMath.PI f64 (f64.const 3.141592653589793))
 (global $~lib/math/rempio2_y0 (mut f64) (f64.const 0))
 (global $~lib/math/rempio2_y1 (mut f64) (f64.const 0))
 (global $~lib/math/res128_hi (mut i64) (i64.const 0))
 (global $~lib/rt/__rtti_base i32 (i32.const 7600))
 (global $~lib/memory/__data_end i32 (i32.const 7648))
 (global $~lib/memory/__stack_pointer (mut i32) (i32.const 40416))
 (global $~lib/memory/__heap_base i32 (i32.const 40416))
 (memory $0 1)
 (data $0 (i32.const 12) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00(\00\00\00A\00l\00l\00o\00c\00a\00t\00i\00o\00n\00 \00t\00o\00o\00 \00l\00a\00r\00g\00e\00\00\00\00\00")
 (data $1 (i32.const 76) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00 \00\00\00~\00l\00i\00b\00/\00r\00t\00/\00i\00t\00c\00m\00s\00.\00t\00s\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $2 (i32.const 144) "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $3 (i32.const 176) "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $4 (i32.const 204) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00$\00\00\00I\00n\00d\00e\00x\00 \00o\00u\00t\00 \00o\00f\00 \00r\00a\00n\00g\00e\00\00\00\00\00\00\00\00\00")
 (data $5 (i32.const 268) ",\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\14\00\00\00~\00l\00i\00b\00/\00r\00t\00.\00t\00s\00\00\00\00\00\00\00\00\00")
 (data $6 (i32.const 320) "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $7 (i32.const 348) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00t\00l\00s\00f\00.\00t\00s\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $8 (i32.const 412) "<\00\00\00\00\00\00\00\00\00\00\00\01\00\00\00 \00\00\00\00\00\00\00 \00\00\00\08\00\00\00(\00\00\00\02\00\00\00\"\00\00\00\n\00\00\00*\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $9 (i32.const 476) "<\00\00\00\00\00\00\00\00\00\00\00\01\00\00\00 \00\00\000\00\00\00\10\00\00\008\00\00\00\18\00\00\002\00\00\00\12\00\00\00:\00\00\00\1a\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $10 (i32.const 540) "<\00\00\00\00\00\00\00\00\00\00\00\01\00\00\00 \00\00\00\0c\00\00\00,\00\00\00\04\00\00\00$\00\00\00\0e\00\00\00.\00\00\00\06\00\00\00&\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $11 (i32.const 604) "<\00\00\00\00\00\00\00\00\00\00\00\01\00\00\00 \00\00\00<\00\00\00\1c\00\00\004\00\00\00\14\00\00\00>\00\00\00\1e\00\00\006\00\00\00\16\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $12 (i32.const 668) "<\00\00\00\00\00\00\00\00\00\00\00\01\00\00\00 \00\00\00\03\00\00\00#\00\00\00\0b\00\00\00+\00\00\00\01\00\00\00!\00\00\00\t\00\00\00)\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $13 (i32.const 732) "<\00\00\00\00\00\00\00\00\00\00\00\01\00\00\00 \00\00\003\00\00\00\13\00\00\00;\00\00\00\1b\00\00\001\00\00\00\11\00\00\009\00\00\00\19\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $14 (i32.const 796) "<\00\00\00\00\00\00\00\00\00\00\00\01\00\00\00 \00\00\00\0f\00\00\00/\00\00\00\07\00\00\00\'\00\00\00\r\00\00\00-\00\00\00\05\00\00\00%\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $15 (i32.const 860) "<\00\00\00\00\00\00\00\00\00\00\00\01\00\00\00 \00\00\00?\00\00\00\1f\00\00\007\00\00\00\17\00\00\00=\00\00\00\1d\00\00\005\00\00\00\15\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $16 (i32.const 924) ",\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\1a\00\00\00~\00l\00i\00b\00/\00a\00r\00r\00a\00y\00.\00t\00s\00\00\00")
 (data $17 (i32.const 972) ",\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\1c\00\00\00I\00n\00v\00a\00l\00i\00d\00 \00l\00e\00n\00g\00t\00h\00")
 (data $18 (i32.const 1020) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00&\00\00\00~\00l\00i\00b\00/\00a\00r\00r\00a\00y\00b\00u\00f\00f\00e\00r\00.\00t\00s\00\00\00\00\00\00\00")
 (data $19 (i32.const 1088) "\00\00\00\00\00\a0\f6?\00\00\00\00\00\00\00\00\00\c8\b9\f2\82,\d6\bf\80V7($\b4\fa<\00\00\00\00\00\80\f6?\00\00\00\00\00\00\00\00\00\08X\bf\bd\d1\d5\bf \f7\e0\d8\08\a5\1c\bd\00\00\00\00\00`\f6?\00\00\00\00\00\00\00\00\00XE\17wv\d5\bfmP\b6\d5\a4b#\bd\00\00\00\00\00@\f6?\00\00\00\00\00\00\00\00\00\f8-\87\ad\1a\d5\bf\d5g\b0\9e\e4\84\e6\bc\00\00\00\00\00 \f6?\00\00\00\00\00\00\00\00\00xw\95_\be\d4\bf\e0>)\93i\1b\04\bd\00\00\00\00\00\00\f6?\00\00\00\00\00\00\00\00\00`\1c\c2\8ba\d4\bf\cc\84LH/\d8\13=\00\00\00\00\00\e0\f5?\00\00\00\00\00\00\00\00\00\a8\86\860\04\d4\bf:\0b\82\ed\f3B\dc<\00\00\00\00\00\c0\f5?\00\00\00\00\00\00\00\00\00HiUL\a6\d3\bf`\94Q\86\c6\b1 =\00\00\00\00\00\a0\f5?\00\00\00\00\00\00\00\00\00\80\98\9a\ddG\d3\bf\92\80\c5\d4MY%=\00\00\00\00\00\80\f5?\00\00\00\00\00\00\00\00\00 \e1\ba\e2\e8\d2\bf\d8+\b7\99\1e{&=\00\00\00\00\00`\f5?\00\00\00\00\00\00\00\00\00\88\de\13Z\89\d2\bf?\b0\cf\b6\14\ca\15=\00\00\00\00\00`\f5?\00\00\00\00\00\00\00\00\00\88\de\13Z\89\d2\bf?\b0\cf\b6\14\ca\15=\00\00\00\00\00@\f5?\00\00\00\00\00\00\00\00\00x\cf\fbA)\d2\bfv\daS($Z\16\bd\00\00\00\00\00 \f5?\00\00\00\00\00\00\00\00\00\98i\c1\98\c8\d1\bf\04T\e7h\bc\af\1f\bd\00\00\00\00\00\00\f5?\00\00\00\00\00\00\00\00\00\a8\ab\ab\\g\d1\bf\f0\a8\823\c6\1f\1f=\00\00\00\00\00\e0\f4?\00\00\00\00\00\00\00\00\00H\ae\f9\8b\05\d1\bffZ\05\fd\c4\a8&\bd\00\00\00\00\00\c0\f4?\00\00\00\00\00\00\00\00\00\90s\e2$\a3\d0\bf\0e\03\f4~\eek\0c\bd\00\00\00\00\00\a0\f4?\00\00\00\00\00\00\00\00\00\d0\b4\94%@\d0\bf\7f-\f4\9e\b86\f0\bc\00\00\00\00\00\a0\f4?\00\00\00\00\00\00\00\00\00\d0\b4\94%@\d0\bf\7f-\f4\9e\b86\f0\bc\00\00\00\00\00\80\f4?\00\00\00\00\00\00\00\00\00@^m\18\b9\cf\bf\87<\99\ab*W\r=\00\00\00\00\00`\f4?\00\00\00\00\00\00\00\00\00`\dc\cb\ad\f0\ce\bf$\af\86\9c\b7&+=\00\00\00\00\00@\f4?\00\00\00\00\00\00\00\00\00\f0*n\07\'\ce\bf\10\ff?TO/\17\bd\00\00\00\00\00 \f4?\00\00\00\00\00\00\00\00\00\c0Ok!\\\cd\bf\1bh\ca\bb\91\ba!=\00\00\00\00\00\00\f4?\00\00\00\00\00\00\00\00\00\a0\9a\c7\f7\8f\cc\bf4\84\9fhOy\'=\00\00\00\00\00\00\f4?\00\00\00\00\00\00\00\00\00\a0\9a\c7\f7\8f\cc\bf4\84\9fhOy\'=\00\00\00\00\00\e0\f3?\00\00\00\00\00\00\00\00\00\90-t\86\c2\cb\bf\8f\b7\8b1\b0N\19=\00\00\00\00\00\c0\f3?\00\00\00\00\00\00\00\00\00\c0\80N\c9\f3\ca\bff\90\cd?cN\ba<\00\00\00\00\00\a0\f3?\00\00\00\00\00\00\00\00\00\b0\e2\1f\bc#\ca\bf\ea\c1F\dcd\8c%\bd\00\00\00\00\00\a0\f3?\00\00\00\00\00\00\00\00\00\b0\e2\1f\bc#\ca\bf\ea\c1F\dcd\8c%\bd\00\00\00\00\00\80\f3?\00\00\00\00\00\00\00\00\00P\f4\9cZR\c9\bf\e3\d4\c1\04\d9\d1*\bd\00\00\00\00\00`\f3?\00\00\00\00\00\00\00\00\00\d0 e\a0\7f\c8\bf\t\fa\db\7f\bf\bd+=\00\00\00\00\00@\f3?\00\00\00\00\00\00\00\00\00\e0\10\02\89\ab\c7\bfXJSr\90\db+=\00\00\00\00\00@\f3?\00\00\00\00\00\00\00\00\00\e0\10\02\89\ab\c7\bfXJSr\90\db+=\00\00\00\00\00 \f3?\00\00\00\00\00\00\00\00\00\d0\19\e7\0f\d6\c6\bff\e2\b2\a3j\e4\10\bd\00\00\00\00\00\00\f3?\00\00\00\00\00\00\00\00\00\90\a7p0\ff\c5\bf9P\10\9fC\9e\1e\bd\00\00\00\00\00\00\f3?\00\00\00\00\00\00\00\00\00\90\a7p0\ff\c5\bf9P\10\9fC\9e\1e\bd\00\00\00\00\00\e0\f2?\00\00\00\00\00\00\00\00\00\b0\a1\e3\e5&\c5\bf\8f[\07\90\8b\de \bd\00\00\00\00\00\c0\f2?\00\00\00\00\00\00\00\00\00\80\cbl+M\c4\bf<x5a\c1\0c\17=\00\00\00\00\00\c0\f2?\00\00\00\00\00\00\00\00\00\80\cbl+M\c4\bf<x5a\c1\0c\17=\00\00\00\00\00\a0\f2?\00\00\00\00\00\00\00\00\00\90\1e \fcq\c3\bf:T\'M\86x\f1<\00\00\00\00\00\80\f2?\00\00\00\00\00\00\00\00\00\f0\1f\f8R\95\c2\bf\08\c4q\170\8d$\bd\00\00\00\00\00`\f2?\00\00\00\00\00\00\00\00\00`/\d5*\b7\c1\bf\96\a3\11\18\a4\80.\bd\00\00\00\00\00`\f2?\00\00\00\00\00\00\00\00\00`/\d5*\b7\c1\bf\96\a3\11\18\a4\80.\bd\00\00\00\00\00@\f2?\00\00\00\00\00\00\00\00\00\90\d0|~\d7\c0\bf\f4[\e8\88\96i\n=\00\00\00\00\00@\f2?\00\00\00\00\00\00\00\00\00\90\d0|~\d7\c0\bf\f4[\e8\88\96i\n=\00\00\00\00\00 \f2?\00\00\00\00\00\00\00\00\00\e0\db1\91\ec\bf\bf\f23\a3\\Tu%\bd\00\00\00\00\00\00\f2?\00\00\00\00\00\00\00\00\00\00+n\07\'\be\bf<\00\f0*,4*=\00\00\00\00\00\00\f2?\00\00\00\00\00\00\00\00\00\00+n\07\'\be\bf<\00\f0*,4*=\00\00\00\00\00\e0\f1?\00\00\00\00\00\00\00\00\00\c0[\8fT^\bc\bf\06\be_XW\0c\1d\bd\00\00\00\00\00\c0\f1?\00\00\00\00\00\00\00\00\00\e0J:m\92\ba\bf\c8\aa[\e859%=\00\00\00\00\00\c0\f1?\00\00\00\00\00\00\00\00\00\e0J:m\92\ba\bf\c8\aa[\e859%=\00\00\00\00\00\a0\f1?\00\00\00\00\00\00\00\00\00\a01\d6E\c3\b8\bfhV/M)|\13=\00\00\00\00\00\a0\f1?\00\00\00\00\00\00\00\00\00\a01\d6E\c3\b8\bfhV/M)|\13=\00\00\00\00\00\80\f1?\00\00\00\00\00\00\00\00\00`\e5\8a\d2\f0\b6\bf\das3\c97\97&\bd\00\00\00\00\00`\f1?\00\00\00\00\00\00\00\00\00 \06?\07\1b\b5\bfW^\c6a[\02\1f=\00\00\00\00\00`\f1?\00\00\00\00\00\00\00\00\00 \06?\07\1b\b5\bfW^\c6a[\02\1f=\00\00\00\00\00@\f1?\00\00\00\00\00\00\00\00\00\e0\1b\96\d7A\b3\bf\df\13\f9\cc\da^,=\00\00\00\00\00@\f1?\00\00\00\00\00\00\00\00\00\e0\1b\96\d7A\b3\bf\df\13\f9\cc\da^,=\00\00\00\00\00 \f1?\00\00\00\00\00\00\00\00\00\80\a3\ee6e\b1\bf\t\a3\8fv^|\14=\00\00\00\00\00\00\f1?\00\00\00\00\00\00\00\00\00\80\11\c00\n\af\bf\91\8e6\83\9eY-=\00\00\00\00\00\00\f1?\00\00\00\00\00\00\00\00\00\80\11\c00\n\af\bf\91\8e6\83\9eY-=\00\00\00\00\00\e0\f0?\00\00\00\00\00\00\00\00\00\80\19q\ddB\ab\bfLp\d6\e5z\82\1c=\00\00\00\00\00\e0\f0?\00\00\00\00\00\00\00\00\00\80\19q\ddB\ab\bfLp\d6\e5z\82\1c=\00\00\00\00\00\c0\f0?\00\00\00\00\00\00\00\00\00\c02\f6Xt\a7\bf\ee\a1\f24F\fc,\bd\00\00\00\00\00\c0\f0?\00\00\00\00\00\00\00\00\00\c02\f6Xt\a7\bf\ee\a1\f24F\fc,\bd\00\00\00\00\00\a0\f0?\00\00\00\00\00\00\00\00\00\c0\fe\b9\87\9e\a3\bf\aa\fe&\f5\b7\02\f5<\00\00\00\00\00\a0\f0?\00\00\00\00\00\00\00\00\00\c0\fe\b9\87\9e\a3\bf\aa\fe&\f5\b7\02\f5<\00\00\00\00\00\80\f0?\00\00\00\00\00\00\00\00\00\00x\0e\9b\82\9f\bf\e4\t~|&\80)\bd\00\00\00\00\00\80\f0?\00\00\00\00\00\00\00\00\00\00x\0e\9b\82\9f\bf\e4\t~|&\80)\bd\00\00\00\00\00`\f0?\00\00\00\00\00\00\00\00\00\80\d5\07\1b\b9\97\bf9\a6\fa\93T\8d(\bd\00\00\00\00\00@\f0?\00\00\00\00\00\00\00\00\00\00\fc\b0\a8\c0\8f\bf\9c\a6\d3\f6|\1e\df\bc\00\00\00\00\00@\f0?\00\00\00\00\00\00\00\00\00\00\fc\b0\a8\c0\8f\bf\9c\a6\d3\f6|\1e\df\bc\00\00\00\00\00 \f0?\00\00\00\00\00\00\00\00\00\00\10k*\e0\7f\bf\e4@\da\r?\e2\19\bd\00\00\00\00\00 \f0?\00\00\00\00\00\00\00\00\00\00\10k*\e0\7f\bf\e4@\da\r?\e2\19\bd\00\00\00\00\00\00\f0?\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\f0?\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\c0\ef?\00\00\00\00\00\00\00\00\00\00\89u\15\10\80?\e8+\9d\99k\c7\10\bd\00\00\00\00\00\80\ef?\00\00\00\00\00\00\00\00\00\80\93XV \90?\d2\f7\e2\06[\dc#\bd\00\00\00\00\00@\ef?\00\00\00\00\00\00\00\00\00\00\c9(%I\98?4\0cZ2\ba\a0*\bd\00\00\00\00\00\00\ef?\00\00\00\00\00\00\00\00\00@\e7\89]A\a0?S\d7\f1\\\c0\11\01=\00\00\00\00\00\c0\ee?\00\00\00\00\00\00\00\00\00\00.\d4\aef\a4?(\fd\bdus\16,\bd\00\00\00\00\00\80\ee?\00\00\00\00\00\00\00\00\00\c0\9f\14\aa\94\a8?}&Z\d0\95y\19\bd\00\00\00\00\00@\ee?\00\00\00\00\00\00\00\00\00\c0\dd\cds\cb\ac?\07(\d8G\f2h\1a\bd\00\00\00\00\00 \ee?\00\00\00\00\00\00\00\00\00\c0\06\c01\ea\ae?{;\c9O>\11\0e\bd\00\00\00\00\00\e0\ed?\00\00\00\00\00\00\00\00\00`F\d1;\97\b1?\9b\9e\rV]2%\bd\00\00\00\00\00\a0\ed?\00\00\00\00\00\00\00\00\00\e0\d1\a7\f5\bd\b3?\d7N\db\a5^\c8,=\00\00\00\00\00`\ed?\00\00\00\00\00\00\00\00\00\a0\97MZ\e9\b5?\1e\1d]<\06i,\bd\00\00\00\00\00@\ed?\00\00\00\00\00\00\00\00\00\c0\ea\n\d3\00\b7?2\ed\9d\a9\8d\1e\ec<\00\00\00\00\00\00\ed?\00\00\00\00\00\00\00\00\00@Y]^3\b9?\daG\bd:\\\11#=\00\00\00\00\00\c0\ec?\00\00\00\00\00\00\00\00\00`\ad\8d\c8j\bb?\e5h\f7+\80\90\13\bd\00\00\00\00\00\a0\ec?\00\00\00\00\00\00\00\00\00@\bc\01X\88\bc?\d3\acZ\c6\d1F&=\00\00\00\00\00`\ec?\00\00\00\00\00\00\00\00\00 \n\839\c7\be?\e0E\e6\afh\c0-\bd\00\00\00\00\00@\ec?\00\00\00\00\00\00\00\00\00\e0\db9\91\e8\bf?\fd\n\a1O\d64%\bd\00\00\00\00\00\00\ec?\00\00\00\00\00\00\00\00\00\e0\'\82\8e\17\c1?\f2\07-\cex\ef!=\00\00\00\00\00\e0\eb?\00\00\00\00\00\00\00\00\00\f0#~+\aa\c1?4\998D\8e\a7,=\00\00\00\00\00\a0\eb?\00\00\00\00\00\00\00\00\00\80\86\0ca\d1\c2?\a1\b4\81\cbl\9d\03=\00\00\00\00\00\80\eb?\00\00\00\00\00\00\00\00\00\90\15\b0\fce\c3?\89rK#\a8/\c6<\00\00\00\00\00@\eb?\00\00\00\00\00\00\00\00\00\b03\83=\91\c4?x\b6\fdTy\83%=\00\00\00\00\00 \eb?\00\00\00\00\00\00\00\00\00\b0\a1\e4\e5\'\c5?\c7}i\e5\e83&=\00\00\00\00\00\e0\ea?\00\00\00\00\00\00\00\00\00\10\8c\beNW\c6?x.<,\8b\cf\19=\00\00\00\00\00\c0\ea?\00\00\00\00\00\00\00\00\00pu\8b\12\f0\c6?\e1!\9c\e5\8d\11%\bd\00\00\00\00\00\a0\ea?\00\00\00\00\00\00\00\00\00PD\85\8d\89\c7?\05C\91p\10f\1c\bd\00\00\00\00\00`\ea?\00\00\00\00\00\00\00\00\00\009\eb\af\be\c8?\d1,\e9\aaT=\07\bd\00\00\00\00\00@\ea?\00\00\00\00\00\00\00\00\00\00\f7\dcZZ\c9?o\ff\a0X(\f2\07=\00\00\00\00\00\00\ea?\00\00\00\00\00\00\00\00\00\e0\8a<\ed\93\ca?i!VPCr(\bd\00\00\00\00\00\e0\e9?\00\00\00\00\00\00\00\00\00\d0[W\d81\cb?\aa\e1\acN\8d5\0c\bd\00\00\00\00\00\c0\e9?\00\00\00\00\00\00\00\00\00\e0;8\87\d0\cb?\b6\12TY\c4K-\bd\00\00\00\00\00\a0\e9?\00\00\00\00\00\00\00\00\00\10\f0\c6\fbo\cc?\d2+\96\c5r\ec\f1\bc\00\00\00\00\00`\e9?\00\00\00\00\00\00\00\00\00\90\d4\b0=\b1\cd?5\b0\15\f7*\ff*\bd\00\00\00\00\00@\e9?\00\00\00\00\00\00\00\00\00\10\e7\ff\0eS\ce?0\f4A`\'\12\c2<\00\00\00\00\00 \e9?\00\00\00\00\00\00\00\00\00\00\dd\e4\ad\f5\ce?\11\8e\bbe\15!\ca\bc\00\00\00\00\00\00\e9?\00\00\00\00\00\00\00\00\00\b0\b3l\1c\99\cf?0\df\0c\ca\ec\cb\1b=\00\00\00\00\00\c0\e8?\00\00\00\00\00\00\00\00\00XM`8q\d0?\91N\ed\16\db\9c\f8<\00\00\00\00\00\a0\e8?\00\00\00\00\00\00\00\00\00`ag-\c4\d0?\e9\ea<\16\8b\18\'=\00\00\00\00\00\80\e8?\00\00\00\00\00\00\00\00\00\e8\'\82\8e\17\d1?\1c\f0\a5c\0e!,\bd\00\00\00\00\00`\e8?\00\00\00\00\00\00\00\00\00\f8\ac\cb\\k\d1?\81\16\a5\f7\cd\9a+=\00\00\00\00\00@\e8?\00\00\00\00\00\00\00\00\00hZc\99\bf\d1?\b7\bdGQ\ed\a6,=\00\00\00\00\00 \e8?\00\00\00\00\00\00\00\00\00\b8\0emE\14\d2?\ea\baF\ba\de\87\n=\00\00\00\00\00\e0\e7?\00\00\00\00\00\00\00\00\00\90\dc|\f0\be\d2?\f4\04PJ\fa\9c*=\00\00\00\00\00\c0\e7?\00\00\00\00\00\00\00\00\00`\d3\e1\f1\14\d3?\b8<!\d3z\e2(\bd\00\00\00\00\00\a0\e7?\00\00\00\00\00\00\00\00\00\10\bevgk\d3?\c8w\f1\b0\cdn\11=\00\00\00\00\00\80\e7?\00\00\00\00\00\00\00\00\0003wR\c2\d3?\\\bd\06\b6T;\18=\00\00\00\00\00`\e7?\00\00\00\00\00\00\00\00\00\e8\d5#\b4\19\d4?\9d\e0\90\ec6\e4\08=\00\00\00\00\00@\e7?\00\00\00\00\00\00\00\00\00\c8q\c2\8dq\d4?u\d6g\t\ce\'/\bd\00\00\00\00\00 \e7?\00\00\00\00\00\00\00\00\000\17\9e\e0\c9\d4?\a4\d8\n\1b\89 .\bd\00\00\00\00\00\00\e7?\00\00\00\00\00\00\00\00\00\a08\07\ae\"\d5?Y\c7d\81p\be.=\00\00\00\00\00\e0\e6?\00\00\00\00\00\00\00\00\00\d0\c8S\f7{\d5?\ef@]\ee\ed\ad\1f=\00\00\00\00\00\c0\e6?\00\00\00\00\00\00\00\00\00`Y\df\bd\d5\d5?\dce\a4\08*\0b\n\bd")
 (data $20 (i32.const 5184) "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\f0?n\bf\88\1aO;\9b<53\fb\a9=\f6\ef?]\dc\d8\9c\13`q\bca\80w>\9a\ec\ef?\d1f\87\10z^\90\bc\85\7fn\e8\15\e3\ef?\13\f6g5R\d2\8c<t\85\15\d3\b0\d9\ef?\fa\8e\f9#\80\ce\8b\bc\de\f6\dd)k\d0\ef?a\c8\e6aN\f7`<\c8\9bu\18E\c7\ef?\99\d33[\e4\a3\90<\83\f3\c6\ca>\be\ef?m{\83]\a6\9a\97<\0f\89\f9lX\b5\ef?\fc\ef\fd\92\1a\b5\8e<\f7Gr+\92\ac\ef?\d1\9c/p=\be><\a2\d1\d32\ec\a3\ef?\0bn\90\894\03j\bc\1b\d3\fe\aff\9b\ef?\0e\bd/*RV\95\bcQ[\12\d0\01\93\ef?U\eaN\8c\ef\80P\bc\cc1l\c0\bd\8a\ef?\16\f4\d5\b9#\c9\91\bc\e0-\a9\ae\9a\82\ef?\afU\\\e9\e3\d3\80<Q\8e\a5\c8\98z\ef?H\93\a5\ea\15\1b\80\bc{Q}<\b8r\ef?=2\deU\f0\1f\8f\bc\ea\8d\8c8\f9j\ef?\bfS\13?\8c\89\8b<u\cbo\eb[c\ef?&\eb\11v\9c\d9\96\bc\d4\\\04\84\e0[\ef?`/:>\f7\ec\9a<\aa\b9h1\87T\ef?\9d8\86\cb\82\e7\8f\bc\1d\d9\fc\"PM\ef?\8d\c3\a6DAo\8a<\d6\8cb\88;F\ef?}\04\e4\b0\05z\80<\96\dc}\91I?\ef?\94\a8\a8\e3\fd\8e\96<8bunz8\ef?}Ht\f2\18^\87<?\a6\b2O\ce1\ef?\f2\e7\1f\98+G\80<\dd|\e2eE+\ef?^\08q?{\b8\96\bc\81c\f5\e1\df$\ef?1\ab\tm\e1\f7\82<\e1\de\1f\f5\9d\1e\ef?\fa\bfo\1a\9b!=\bc\90\d9\da\d0\7f\18\ef?\b4\n\0cr\827\8b<\0b\03\e4\a6\85\12\ef?\8f\cb\ce\89\92\14n<V/>\a9\af\0c\ef?\b6\ab\b0MuM\83<\15\b71\n\fe\06\ef?Lt\ac\e2\01B\86<1\d8L\fcp\01\ef?J\f8\d3]9\dd\8f<\ff\16d\b2\08\fc\ee?\04[\8e;\80\a3\86\bc\f1\9f\92_\c5\f6\ee?hPK\cc\edJ\92\bc\cb\a9:7\a7\f1\ee?\8e-Q\1b\f8\07\99\bcf\d8\05m\ae\ec\ee?\d26\94>\e8\d1q\bc\f7\9f\e54\db\e7\ee?\15\1b\ce\b3\19\19\99\bc\e5\a8\13\c3-\e3\ee?mL*\a7H\9f\85<\"4\12L\a6\de\ee?\8ai(z`\12\93\bc\1c\80\ac\04E\da\ee?[\89\17H\8f\a7X\bc*.\f7!\n\d6\ee?\1b\9aIg\9b,|\bc\97\a8P\d9\f5\d1\ee?\11\ac\c2`\edcC<-\89a`\08\ce\ee?\efd\06;\tf\96<W\00\1d\edA\ca\ee?y\03\a1\da\e1\ccn<\d0<\c1\b5\a2\c6\ee?0\12\0f?\8e\ff\93<\de\d3\d7\f0*\c3\ee?\b0\afz\bb\ce\90v<\'*6\d5\da\bf\ee?w\e0T\eb\bd\1d\93<\r\dd\fd\99\b2\bc\ee?\8e\a3q\004\94\8f\bc\a7,\9dv\b2\b9\ee?I\a3\93\dc\cc\de\87\bcBf\cf\a2\da\b6\ee?_8\0f\bd\c6\dex\bc\82O\9dV+\b4\ee?\f6\\{\ecF\12\86\bc\0f\92]\ca\a4\b1\ee?\8e\d7\fd\18\055\93<\da\'\b56G\af\ee?\05\9b\8a/\b7\98{<\fd\c7\97\d4\12\ad\ee?\tT\1c\e2\e1c\90<)TH\dd\07\ab\ee?\ea\c6\19P\85\c74<\b7FY\8a&\a9\ee?5\c0d+\e62\94<H!\ad\15o\a7\ee?\9fv\99aJ\e4\8c\bc\t\dcv\b9\e1\a5\ee?\a8M\ef;\c53\8c\bc\85U:\b0~\a4\ee?\ae\e9+\89xS\84\bc \c3\cc4F\a3\ee?XXVx\dd\ce\93\bc%\"U\828\a2\ee?d\19~\80\aa\10W<s\a9L\d4U\a1\ee?(\"^\bf\ef\b3\93\bc\cd;\7ff\9e\a0\ee?\82\b94\87\ad\12j\bc\bf\da\0bu\12\a0\ee?\ee\a9m\b8\efgc\bc/\1ae<\b2\9f\ee?Q\88\e0T=\dc\80\bc\84\94Q\f9}\9f\ee?\cf>Z~d\1fx\bct_\ec\e8u\9f\ee?\b0}\8b\c0J\ee\86\bct\81\a5H\9a\9f\ee?\8a\e6U\1e2\19\86\bc\c9gBV\eb\9f\ee?\d3\d4\t^\cb\9c\90<?]\deOi\a0\ee?\1d\a5M\b9\dc2{\bc\87\01\ebs\14\a1\ee?k\c0gT\fd\ec\94<2\c10\01\ed\a1\ee?Ul\d6\ab\e1\ebe<bN\cf6\f3\a2\ee?B\cf\b3/\c5\a1\88\bc\12\1a>T\'\a4\ee?47;\f1\b6i\93\bc\13\ceL\99\89\a5\ee?\1e\ff\19:\84^\80\bc\ad\c7#F\1a\a7\ee?nWr\d8P\d4\94\bc\ed\92D\9b\d9\a8\ee?\00\8a\0e[g\ad\90<\99f\8a\d9\c7\aa\ee?\b4\ea\f0\c1/\b7\8d<\db\a0*B\e5\ac\ee?\ff\e7\c5\9c`\b6e\bc\8cD\b5\162\af\ee?D_\f3Y\83\f6{<6w\15\99\ae\b1\ee?\83=\1e\a7\1f\t\93\bc\c6\ff\91\0b[\b4\ee?)\1el\8b\b8\a9]\bc\e5\c5\cd\b07\b7\ee?Y\b9\90|\f9#l\bc\0fR\c8\cbD\ba\ee?\aa\f9\f4\"CC\92\bcPN\de\9f\82\bd\ee?K\8ef\d7l\ca\85\bc\ba\07\cap\f1\c0\ee?\'\ce\91+\fc\afq<\90\f0\a3\82\91\c4\ee?\bbs\n\e15\d2m<##\e3\19c\c8\ee?c\"b\"\04\c5\87\bce\e5]{f\cc\ee?\d51\e2\e3\86\1c\8b<3-J\ec\9b\d0\ee?\15\bb\bc\d3\d1\bb\91\bc]%>\b2\03\d5\ee?\d21\ee\9c1\cc\90<X\b30\13\9e\d9\ee?\b3Zsn\84i\84<\bf\fdyUk\de\ee?\b4\9d\8e\97\cd\df\82\bcz\f3\d3\bfk\e3\ee?\873\cb\92w\1a\8c<\ad\d3Z\99\9f\e8\ee?\fa\d9\d1J\8f{\90\bcf\b6\8d)\07\ee\ee?\ba\ae\dcV\d9\c3U\bc\fb\15O\b8\a2\f3\ee?@\f6\a6=\0e\a4\90\bc:Y\e5\8dr\f9\ee?4\93\ad8\f4\d6h\bcG^\fb\f2v\ff\ee?5\8aXk\e2\ee\91\bcJ\06\a10\b0\05\ef?\cd\dd_\n\d7\fft<\d2\c1K\90\1e\0c\ef?\ac\98\92\fa\fb\bd\91\bc\t\1e\d7[\c2\12\ef?\b3\0c\af0\aens<\9cR\85\dd\9b\19\ef?\94\fd\9f\\2\e3\8e<z\d0\ff_\ab \ef?\acY\t\d1\8f\e0\84<K\d1W.\f1\'\ef?g\1aN8\af\cdc<\b5\e7\06\94m/\ef?h\19\92l,kg<i\90\ef\dc 7\ef?\d2\b5\cc\83\18\8a\80\bc\fa\c3]U\0b?\ef?o\fa\ff?]\ad\8f\bc|\89\07J-G\ef?I\a9u8\ae\r\90\bc\f2\89\r\08\87O\ef?\a7\07=\a6\85\a3t<\87\a4\fb\dc\18X\ef?\0f\"@ \9e\91\82\bc\98\83\c9\16\e3`\ef?\ac\92\c1\d5PZ\8e<\852\db\03\e6i\ef?Kk\01\acY:\84<`\b4\01\f3!s\ef?\1f>\b4\07!\d5\82\bc_\9b{3\97|\ef?\c9\rG;\b9*\89\bc)\a1\f5\14F\86\ef?\d3\88:`\04\b6t<\f6?\8b\e7.\90\ef?qr\9dQ\ec\c5\83<\83L\c7\fbQ\9a\ef?\f0\91\d3\8f\12\f7\8f\bc\da\90\a4\a2\af\a4\ef?}t#\e2\98\ae\8d\bc\f1g\8e-H\af\ef?\08 \aaA\bc\c3\8e<\'Za\ee\1b\ba\ef?2\eb\a9\c3\94+\84<\97\bak7+\c5\ef?\ee\85\d11\a9d\8a<@En[v\d0\ef?\ed\e3;\e4\ba7\8e\bc\14\be\9c\ad\fd\db\ef?\9d\cd\91M;\89w<\d8\90\9e\81\c1\e7\ef?\89\cc`A\c1\05S<\f1q\8f+\c2\f3\ef?")
 (data $21 (i32.const 7232) "n\83\f9\a2\00\00\00\00\d1W\'\fc)\15DN\99\95b\db\c0\dd4\f5\abcQ\feA\90C<:n$\b7a\c5\bb\de\ea.I\06\e0\d2MB\1c\eb\1d\fe\1c\92\d1\t\f55\82\e8>\a7)\b1&p\9c\e9\84D\bb.9\d6\919A~_\b4\8b_\84\9c\f49S\83\ff\97\f8\1f;(\f9\bd\8b\11/\ef\0f\98\05\de\cf~6m\1fm\nZf?FO\b7\t\cb\'\c7\ba\'u-\ea_\9e\f79\07={\f1\e5\eb\b1_\fbk\ea\92R\8aF0\03V\08]\8d\1f \bc\cf\f0\abk{\fca\91\e3\a9\1d6\f4\9a_\85\99e\08\1b\e6^\80\d8\ff\8d@h\a0\14W\15\06\061\'sM")
 (data $22 (i32.const 7436) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00$\00\00\00~\00l\00i\00b\00/\00t\00y\00p\00e\00d\00a\00r\00r\00a\00y\00.\00t\00s\00\00\00\00\00\00\00\00\00")
 (data $23 (i32.const 7500) ",\00\00\00\00\00\00\00\00\00\00\00\01\00\00\00\10\00\00\00\01\00\00\00\ff\ff\ff\ff\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $24 (i32.const 7548) ",\00\00\00\00\00\00\00\00\00\00\00\01\00\00\00\10\00\00\00\00\00\00\00\00\00\00\00\01\00\00\00\ff\ff\ff\ff\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $25 (i32.const 7600) "\0b\00\00\00 \00\00\00 \00\00\00 \00\00\00\00\00\00\00 \00\00\00 \00\00\00\02\t\00\00\02A\00\00A\00\00\00\01\t\00\00\01\01\00\00")
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
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
 (func $~lib/rt/itcms/Object#set:nextWithColor (param $this i32) (param $nextWithColor i32)
  local.get $this
  local.get $nextWithColor
  i32.store offset=4
 )
 (func $~lib/rt/itcms/Object#set:prev (param $this i32) (param $prev i32)
  local.get $this
  local.get $prev
  i32.store offset=8
 )
 (func $~lib/rt/itcms/initLazy (param $space i32) (result i32)
  local.get $space
  local.get $space
  call $~lib/rt/itcms/Object#set:nextWithColor
  local.get $space
  local.get $space
  call $~lib/rt/itcms/Object#set:prev
  local.get $space
  return
 )
 (func $~lib/rt/itcms/Object#get:nextWithColor (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/rt/itcms/Object#get:next (param $this i32) (result i32)
  local.get $this
  call $~lib/rt/itcms/Object#get:nextWithColor
  i32.const 3
  i32.const -1
  i32.xor
  i32.and
  return
 )
 (func $~lib/rt/itcms/Object#get:color (param $this i32) (result i32)
  local.get $this
  call $~lib/rt/itcms/Object#get:nextWithColor
  i32.const 3
  i32.and
  return
 )
 (func $~lib/rt/itcms/visitRoots (param $cookie i32)
  (local $pn i32)
  (local $iter i32)
  local.get $cookie
  call $~lib/rt/__visit_globals
  global.get $~lib/rt/itcms/pinSpace
  local.set $pn
  local.get $pn
  call $~lib/rt/itcms/Object#get:next
  local.set $iter
  loop $while-continue|0
   local.get $iter
   local.get $pn
   i32.ne
   if
    i32.const 1
    drop
    local.get $iter
    call $~lib/rt/itcms/Object#get:color
    i32.const 3
    i32.eq
    i32.eqz
    if
     i32.const 0
     i32.const 96
     i32.const 160
     i32.const 16
     call $~lib/builtins/abort
     unreachable
    end
    local.get $iter
    i32.const 20
    i32.add
    local.get $cookie
    call $~lib/rt/__visit_members
    local.get $iter
    call $~lib/rt/itcms/Object#get:next
    local.set $iter
    br $while-continue|0
   end
  end
 )
 (func $~lib/rt/itcms/Object#set:color (param $this i32) (param $color i32)
  local.get $this
  local.get $this
  call $~lib/rt/itcms/Object#get:nextWithColor
  i32.const 3
  i32.const -1
  i32.xor
  i32.and
  local.get $color
  i32.or
  call $~lib/rt/itcms/Object#set:nextWithColor
 )
 (func $~lib/rt/itcms/Object#get:prev (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $~lib/rt/itcms/Object#set:next (param $this i32) (param $obj i32)
  local.get $this
  local.get $obj
  local.get $this
  call $~lib/rt/itcms/Object#get:nextWithColor
  i32.const 3
  i32.and
  i32.or
  call $~lib/rt/itcms/Object#set:nextWithColor
 )
 (func $~lib/rt/itcms/Object#unlink (param $this i32)
  (local $next i32)
  (local $prev i32)
  local.get $this
  call $~lib/rt/itcms/Object#get:next
  local.set $next
  local.get $next
  i32.const 0
  i32.eq
  if
   i32.const 1
   drop
   local.get $this
   call $~lib/rt/itcms/Object#get:prev
   i32.const 0
   i32.eq
   if (result i32)
    local.get $this
    global.get $~lib/memory/__heap_base
    i32.lt_u
   else
    i32.const 0
   end
   i32.eqz
   if
    i32.const 0
    i32.const 96
    i32.const 128
    i32.const 18
    call $~lib/builtins/abort
    unreachable
   end
   return
  end
  local.get $this
  call $~lib/rt/itcms/Object#get:prev
  local.set $prev
  i32.const 1
  drop
  local.get $prev
  i32.eqz
  if
   i32.const 0
   i32.const 96
   i32.const 132
   i32.const 16
   call $~lib/builtins/abort
   unreachable
  end
  local.get $next
  local.get $prev
  call $~lib/rt/itcms/Object#set:prev
  local.get $prev
  local.get $next
  call $~lib/rt/itcms/Object#set:next
 )
 (func $~lib/rt/itcms/Object#get:rtId (param $this i32) (result i32)
  local.get $this
  i32.load offset=12
 )
 (func $~lib/shared/typeinfo/Typeinfo#get:flags (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/rt/__typeinfo (param $id i32) (result i32)
  (local $ptr i32)
  global.get $~lib/rt/__rtti_base
  local.set $ptr
  local.get $id
  local.get $ptr
  i32.load
  i32.gt_u
  if
   i32.const 224
   i32.const 288
   i32.const 21
   i32.const 28
   call $~lib/builtins/abort
   unreachable
  end
  local.get $ptr
  i32.const 4
  i32.add
  local.get $id
  i32.const 4
  i32.mul
  i32.add
  call $~lib/shared/typeinfo/Typeinfo#get:flags
  return
 )
 (func $~lib/rt/itcms/Object#get:isPointerfree (param $this i32) (result i32)
  (local $rtId i32)
  local.get $this
  call $~lib/rt/itcms/Object#get:rtId
  local.set $rtId
  local.get $rtId
  i32.const 2
  i32.le_u
  if (result i32)
   i32.const 1
  else
   local.get $rtId
   call $~lib/rt/__typeinfo
   i32.const 32
   i32.and
   i32.const 0
   i32.ne
  end
  return
 )
 (func $~lib/rt/itcms/Object#linkTo (param $this i32) (param $list i32) (param $withColor i32)
  (local $prev i32)
  local.get $list
  call $~lib/rt/itcms/Object#get:prev
  local.set $prev
  local.get $this
  local.get $list
  local.get $withColor
  i32.or
  call $~lib/rt/itcms/Object#set:nextWithColor
  local.get $this
  local.get $prev
  call $~lib/rt/itcms/Object#set:prev
  local.get $prev
  local.get $this
  call $~lib/rt/itcms/Object#set:next
  local.get $list
  local.get $this
  call $~lib/rt/itcms/Object#set:prev
 )
 (func $~lib/rt/itcms/Object#makeGray (param $this i32)
  (local $1 i32)
  local.get $this
  global.get $~lib/rt/itcms/iter
  i32.eq
  if
   local.get $this
   call $~lib/rt/itcms/Object#get:prev
   local.tee $1
   i32.eqz
   if (result i32)
    i32.const 0
    i32.const 96
    i32.const 148
    i32.const 30
    call $~lib/builtins/abort
    unreachable
   else
    local.get $1
   end
   global.set $~lib/rt/itcms/iter
  end
  local.get $this
  call $~lib/rt/itcms/Object#unlink
  local.get $this
  global.get $~lib/rt/itcms/toSpace
  local.get $this
  call $~lib/rt/itcms/Object#get:isPointerfree
  if (result i32)
   global.get $~lib/rt/itcms/white
   i32.eqz
  else
   i32.const 2
  end
  call $~lib/rt/itcms/Object#linkTo
 )
 (func $~lib/rt/itcms/__visit (param $ptr i32) (param $cookie i32)
  (local $obj i32)
  local.get $ptr
  i32.eqz
  if
   return
  end
  local.get $ptr
  i32.const 20
  i32.sub
  local.set $obj
  i32.const 0
  drop
  local.get $obj
  call $~lib/rt/itcms/Object#get:color
  global.get $~lib/rt/itcms/white
  i32.eq
  if
   local.get $obj
   call $~lib/rt/itcms/Object#makeGray
   global.get $~lib/rt/itcms/visitCount
   i32.const 1
   i32.add
   global.set $~lib/rt/itcms/visitCount
  end
 )
 (func $~lib/rt/itcms/visitStack (param $cookie i32)
  (local $ptr i32)
  global.get $~lib/memory/__stack_pointer
  local.set $ptr
  loop $while-continue|0
   local.get $ptr
   global.get $~lib/memory/__heap_base
   i32.lt_u
   if
    local.get $ptr
    i32.load
    local.get $cookie
    call $~lib/rt/itcms/__visit
    local.get $ptr
    i32.const 4
    i32.add
    local.set $ptr
    br $while-continue|0
   end
  end
 )
 (func $~lib/rt/common/BLOCK#get:mmInfo (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/rt/itcms/Object#get:size (param $this i32) (result i32)
  i32.const 4
  local.get $this
  call $~lib/rt/common/BLOCK#get:mmInfo
  i32.const 3
  i32.const -1
  i32.xor
  i32.and
  i32.add
  return
 )
 (func $~lib/rt/tlsf/Root#set:flMap (param $this i32) (param $flMap i32)
  local.get $this
  local.get $flMap
  i32.store
 )
 (func $~lib/rt/common/BLOCK#set:mmInfo (param $this i32) (param $mmInfo i32)
  local.get $this
  local.get $mmInfo
  i32.store
 )
 (func $~lib/rt/tlsf/Block#set:prev (param $this i32) (param $prev i32)
  local.get $this
  local.get $prev
  i32.store offset=4
 )
 (func $~lib/rt/tlsf/Block#set:next (param $this i32) (param $next i32)
  local.get $this
  local.get $next
  i32.store offset=8
 )
 (func $~lib/rt/tlsf/Block#get:prev (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/rt/tlsf/Block#get:next (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $~lib/rt/tlsf/Root#get:flMap (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/rt/tlsf/removeBlock (param $root i32) (param $block i32)
  (local $blockInfo i32)
  (local $size i32)
  (local $fl i32)
  (local $sl i32)
  (local $6 i32)
  (local $7 i32)
  (local $boundedSize i32)
  (local $prev i32)
  (local $next i32)
  (local $root|11 i32)
  (local $fl|12 i32)
  (local $sl|13 i32)
  (local $root|14 i32)
  (local $fl|15 i32)
  (local $sl|16 i32)
  (local $head i32)
  (local $root|18 i32)
  (local $fl|19 i32)
  (local $slMap i32)
  (local $root|21 i32)
  (local $fl|22 i32)
  (local $slMap|23 i32)
  local.get $block
  call $~lib/rt/common/BLOCK#get:mmInfo
  local.set $blockInfo
  i32.const 1
  drop
  local.get $blockInfo
  i32.const 1
  i32.and
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 268
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $blockInfo
  i32.const 3
  i32.const -1
  i32.xor
  i32.and
  local.set $size
  i32.const 1
  drop
  local.get $size
  i32.const 12
  i32.ge_u
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 270
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $size
  i32.const 256
  i32.lt_u
  if
   i32.const 0
   local.set $fl
   local.get $size
   i32.const 4
   i32.shr_u
   local.set $sl
  else
   local.get $size
   local.tee $6
   i32.const 1073741820
   local.tee $7
   local.get $6
   local.get $7
   i32.lt_u
   select
   local.set $boundedSize
   i32.const 31
   local.get $boundedSize
   i32.clz
   i32.sub
   local.set $fl
   local.get $boundedSize
   local.get $fl
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 1
   i32.const 4
   i32.shl
   i32.xor
   local.set $sl
   local.get $fl
   i32.const 8
   i32.const 1
   i32.sub
   i32.sub
   local.set $fl
  end
  i32.const 1
  drop
  local.get $fl
  i32.const 23
  i32.lt_u
  if (result i32)
   local.get $sl
   i32.const 16
   i32.lt_u
  else
   i32.const 0
  end
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 284
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $block
  call $~lib/rt/tlsf/Block#get:prev
  local.set $prev
  local.get $block
  call $~lib/rt/tlsf/Block#get:next
  local.set $next
  local.get $prev
  if
   local.get $prev
   local.get $next
   call $~lib/rt/tlsf/Block#set:next
  end
  local.get $next
  if
   local.get $next
   local.get $prev
   call $~lib/rt/tlsf/Block#set:prev
  end
  local.get $block
  block $~lib/rt/tlsf/GETHEAD|inlined.0 (result i32)
   local.get $root
   local.set $root|11
   local.get $fl
   local.set $fl|12
   local.get $sl
   local.set $sl|13
   local.get $root|11
   local.get $fl|12
   i32.const 4
   i32.shl
   local.get $sl|13
   i32.add
   i32.const 2
   i32.shl
   i32.add
   i32.load offset=96
   br $~lib/rt/tlsf/GETHEAD|inlined.0
  end
  i32.eq
  if
   local.get $root
   local.set $root|14
   local.get $fl
   local.set $fl|15
   local.get $sl
   local.set $sl|16
   local.get $next
   local.set $head
   local.get $root|14
   local.get $fl|15
   i32.const 4
   i32.shl
   local.get $sl|16
   i32.add
   i32.const 2
   i32.shl
   i32.add
   local.get $head
   i32.store offset=96
   local.get $next
   i32.eqz
   if
    block $~lib/rt/tlsf/GETSL|inlined.0 (result i32)
     local.get $root
     local.set $root|18
     local.get $fl
     local.set $fl|19
     local.get $root|18
     local.get $fl|19
     i32.const 2
     i32.shl
     i32.add
     i32.load offset=4
     br $~lib/rt/tlsf/GETSL|inlined.0
    end
    local.set $slMap
    local.get $root
    local.set $root|21
    local.get $fl
    local.set $fl|22
    local.get $slMap
    i32.const 1
    local.get $sl
    i32.shl
    i32.const -1
    i32.xor
    i32.and
    local.tee $slMap
    local.set $slMap|23
    local.get $root|21
    local.get $fl|22
    i32.const 2
    i32.shl
    i32.add
    local.get $slMap|23
    i32.store offset=4
    local.get $slMap
    i32.eqz
    if
     local.get $root
     local.get $root
     call $~lib/rt/tlsf/Root#get:flMap
     i32.const 1
     local.get $fl
     i32.shl
     i32.const -1
     i32.xor
     i32.and
     call $~lib/rt/tlsf/Root#set:flMap
    end
   end
  end
 )
 (func $~lib/rt/tlsf/insertBlock (param $root i32) (param $block i32)
  (local $blockInfo i32)
  (local $block|3 i32)
  (local $right i32)
  (local $rightInfo i32)
  (local $block|6 i32)
  (local $block|7 i32)
  (local $left i32)
  (local $leftInfo i32)
  (local $size i32)
  (local $fl i32)
  (local $sl i32)
  (local $13 i32)
  (local $14 i32)
  (local $boundedSize i32)
  (local $root|16 i32)
  (local $fl|17 i32)
  (local $sl|18 i32)
  (local $head i32)
  (local $root|20 i32)
  (local $fl|21 i32)
  (local $sl|22 i32)
  (local $head|23 i32)
  (local $root|24 i32)
  (local $fl|25 i32)
  (local $root|26 i32)
  (local $fl|27 i32)
  (local $slMap i32)
  i32.const 1
  drop
  local.get $block
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 201
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $block
  call $~lib/rt/common/BLOCK#get:mmInfo
  local.set $blockInfo
  i32.const 1
  drop
  local.get $blockInfo
  i32.const 1
  i32.and
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 203
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  block $~lib/rt/tlsf/GETRIGHT|inlined.0 (result i32)
   local.get $block
   local.set $block|3
   local.get $block|3
   i32.const 4
   i32.add
   local.get $block|3
   call $~lib/rt/common/BLOCK#get:mmInfo
   i32.const 3
   i32.const -1
   i32.xor
   i32.and
   i32.add
   br $~lib/rt/tlsf/GETRIGHT|inlined.0
  end
  local.set $right
  local.get $right
  call $~lib/rt/common/BLOCK#get:mmInfo
  local.set $rightInfo
  local.get $rightInfo
  i32.const 1
  i32.and
  if
   local.get $root
   local.get $right
   call $~lib/rt/tlsf/removeBlock
   local.get $block
   local.get $blockInfo
   i32.const 4
   i32.add
   local.get $rightInfo
   i32.const 3
   i32.const -1
   i32.xor
   i32.and
   i32.add
   local.tee $blockInfo
   call $~lib/rt/common/BLOCK#set:mmInfo
   block $~lib/rt/tlsf/GETRIGHT|inlined.1 (result i32)
    local.get $block
    local.set $block|6
    local.get $block|6
    i32.const 4
    i32.add
    local.get $block|6
    call $~lib/rt/common/BLOCK#get:mmInfo
    i32.const 3
    i32.const -1
    i32.xor
    i32.and
    i32.add
    br $~lib/rt/tlsf/GETRIGHT|inlined.1
   end
   local.set $right
   local.get $right
   call $~lib/rt/common/BLOCK#get:mmInfo
   local.set $rightInfo
  end
  local.get $blockInfo
  i32.const 2
  i32.and
  if
   block $~lib/rt/tlsf/GETFREELEFT|inlined.0 (result i32)
    local.get $block
    local.set $block|7
    local.get $block|7
    i32.const 4
    i32.sub
    i32.load
    br $~lib/rt/tlsf/GETFREELEFT|inlined.0
   end
   local.set $left
   local.get $left
   call $~lib/rt/common/BLOCK#get:mmInfo
   local.set $leftInfo
   i32.const 1
   drop
   local.get $leftInfo
   i32.const 1
   i32.and
   i32.eqz
   if
    i32.const 0
    i32.const 368
    i32.const 221
    i32.const 16
    call $~lib/builtins/abort
    unreachable
   end
   local.get $root
   local.get $left
   call $~lib/rt/tlsf/removeBlock
   local.get $left
   local.set $block
   local.get $block
   local.get $leftInfo
   i32.const 4
   i32.add
   local.get $blockInfo
   i32.const 3
   i32.const -1
   i32.xor
   i32.and
   i32.add
   local.tee $blockInfo
   call $~lib/rt/common/BLOCK#set:mmInfo
  end
  local.get $right
  local.get $rightInfo
  i32.const 2
  i32.or
  call $~lib/rt/common/BLOCK#set:mmInfo
  local.get $blockInfo
  i32.const 3
  i32.const -1
  i32.xor
  i32.and
  local.set $size
  i32.const 1
  drop
  local.get $size
  i32.const 12
  i32.ge_u
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 233
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  i32.const 1
  drop
  local.get $block
  i32.const 4
  i32.add
  local.get $size
  i32.add
  local.get $right
  i32.eq
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 234
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $right
  i32.const 4
  i32.sub
  local.get $block
  i32.store
  local.get $size
  i32.const 256
  i32.lt_u
  if
   i32.const 0
   local.set $fl
   local.get $size
   i32.const 4
   i32.shr_u
   local.set $sl
  else
   local.get $size
   local.tee $13
   i32.const 1073741820
   local.tee $14
   local.get $13
   local.get $14
   i32.lt_u
   select
   local.set $boundedSize
   i32.const 31
   local.get $boundedSize
   i32.clz
   i32.sub
   local.set $fl
   local.get $boundedSize
   local.get $fl
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 1
   i32.const 4
   i32.shl
   i32.xor
   local.set $sl
   local.get $fl
   i32.const 8
   i32.const 1
   i32.sub
   i32.sub
   local.set $fl
  end
  i32.const 1
  drop
  local.get $fl
  i32.const 23
  i32.lt_u
  if (result i32)
   local.get $sl
   i32.const 16
   i32.lt_u
  else
   i32.const 0
  end
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 251
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  block $~lib/rt/tlsf/GETHEAD|inlined.1 (result i32)
   local.get $root
   local.set $root|16
   local.get $fl
   local.set $fl|17
   local.get $sl
   local.set $sl|18
   local.get $root|16
   local.get $fl|17
   i32.const 4
   i32.shl
   local.get $sl|18
   i32.add
   i32.const 2
   i32.shl
   i32.add
   i32.load offset=96
   br $~lib/rt/tlsf/GETHEAD|inlined.1
  end
  local.set $head
  local.get $block
  i32.const 0
  call $~lib/rt/tlsf/Block#set:prev
  local.get $block
  local.get $head
  call $~lib/rt/tlsf/Block#set:next
  local.get $head
  if
   local.get $head
   local.get $block
   call $~lib/rt/tlsf/Block#set:prev
  end
  local.get $root
  local.set $root|20
  local.get $fl
  local.set $fl|21
  local.get $sl
  local.set $sl|22
  local.get $block
  local.set $head|23
  local.get $root|20
  local.get $fl|21
  i32.const 4
  i32.shl
  local.get $sl|22
  i32.add
  i32.const 2
  i32.shl
  i32.add
  local.get $head|23
  i32.store offset=96
  local.get $root
  local.get $root
  call $~lib/rt/tlsf/Root#get:flMap
  i32.const 1
  local.get $fl
  i32.shl
  i32.or
  call $~lib/rt/tlsf/Root#set:flMap
  local.get $root
  local.set $root|26
  local.get $fl
  local.set $fl|27
  block $~lib/rt/tlsf/GETSL|inlined.1 (result i32)
   local.get $root
   local.set $root|24
   local.get $fl
   local.set $fl|25
   local.get $root|24
   local.get $fl|25
   i32.const 2
   i32.shl
   i32.add
   i32.load offset=4
   br $~lib/rt/tlsf/GETSL|inlined.1
  end
  i32.const 1
  local.get $sl
  i32.shl
  i32.or
  local.set $slMap
  local.get $root|26
  local.get $fl|27
  i32.const 2
  i32.shl
  i32.add
  local.get $slMap
  i32.store offset=4
 )
 (func $~lib/rt/tlsf/addMemory (param $root i32) (param $start i32) (param $endU64 i64) (result i32)
  (local $end i32)
  (local $root|4 i32)
  (local $tail i32)
  (local $tailInfo i32)
  (local $size i32)
  (local $leftSize i32)
  (local $left i32)
  (local $root|10 i32)
  (local $tail|11 i32)
  local.get $endU64
  i32.wrap_i64
  local.set $end
  i32.const 1
  drop
  local.get $start
  i64.extend_i32_u
  local.get $endU64
  i64.le_u
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 382
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $start
  i32.const 4
  i32.add
  i32.const 15
  i32.add
  i32.const 15
  i32.const -1
  i32.xor
  i32.and
  i32.const 4
  i32.sub
  local.set $start
  local.get $end
  i32.const 15
  i32.const -1
  i32.xor
  i32.and
  local.set $end
  block $~lib/rt/tlsf/GETTAIL|inlined.0 (result i32)
   local.get $root
   local.set $root|4
   local.get $root|4
   i32.load offset=1568
   br $~lib/rt/tlsf/GETTAIL|inlined.0
  end
  local.set $tail
  i32.const 0
  local.set $tailInfo
  local.get $tail
  if
   i32.const 1
   drop
   local.get $start
   local.get $tail
   i32.const 4
   i32.add
   i32.ge_u
   i32.eqz
   if
    i32.const 0
    i32.const 368
    i32.const 389
    i32.const 16
    call $~lib/builtins/abort
    unreachable
   end
   local.get $start
   i32.const 16
   i32.sub
   local.get $tail
   i32.eq
   if
    local.get $start
    i32.const 16
    i32.sub
    local.set $start
    local.get $tail
    call $~lib/rt/common/BLOCK#get:mmInfo
    local.set $tailInfo
   else
   end
  else
   i32.const 1
   drop
   local.get $start
   local.get $root
   i32.const 1572
   i32.add
   i32.ge_u
   i32.eqz
   if
    i32.const 0
    i32.const 368
    i32.const 402
    i32.const 5
    call $~lib/builtins/abort
    unreachable
   end
  end
  local.get $end
  local.get $start
  i32.sub
  local.set $size
  local.get $size
  i32.const 4
  i32.const 12
  i32.add
  i32.const 4
  i32.add
  i32.lt_u
  if
   i32.const 0
   return
  end
  local.get $size
  i32.const 2
  i32.const 4
  i32.mul
  i32.sub
  local.set $leftSize
  local.get $start
  local.set $left
  local.get $left
  local.get $leftSize
  i32.const 1
  i32.or
  local.get $tailInfo
  i32.const 2
  i32.and
  i32.or
  call $~lib/rt/common/BLOCK#set:mmInfo
  local.get $left
  i32.const 0
  call $~lib/rt/tlsf/Block#set:prev
  local.get $left
  i32.const 0
  call $~lib/rt/tlsf/Block#set:next
  local.get $start
  i32.const 4
  i32.add
  local.get $leftSize
  i32.add
  local.set $tail
  local.get $tail
  i32.const 0
  i32.const 2
  i32.or
  call $~lib/rt/common/BLOCK#set:mmInfo
  local.get $root
  local.set $root|10
  local.get $tail
  local.set $tail|11
  local.get $root|10
  local.get $tail|11
  i32.store offset=1568
  local.get $root
  local.get $left
  call $~lib/rt/tlsf/insertBlock
  i32.const 1
  return
 )
 (func $~lib/rt/tlsf/initialize
  (local $rootOffset i32)
  (local $pagesBefore i32)
  (local $pagesNeeded i32)
  (local $root i32)
  (local $root|4 i32)
  (local $tail i32)
  (local $fl i32)
  (local $root|7 i32)
  (local $fl|8 i32)
  (local $slMap i32)
  (local $sl i32)
  (local $root|11 i32)
  (local $fl|12 i32)
  (local $sl|13 i32)
  (local $head i32)
  (local $memStart i32)
  i32.const 0
  drop
  global.get $~lib/memory/__heap_base
  i32.const 15
  i32.add
  i32.const 15
  i32.const -1
  i32.xor
  i32.and
  local.set $rootOffset
  memory.size
  local.set $pagesBefore
  local.get $rootOffset
  i32.const 1572
  i32.add
  i32.const 65535
  i32.add
  i32.const 65535
  i32.const -1
  i32.xor
  i32.and
  i32.const 16
  i32.shr_u
  local.set $pagesNeeded
  local.get $pagesNeeded
  local.get $pagesBefore
  i32.gt_s
  if (result i32)
   local.get $pagesNeeded
   local.get $pagesBefore
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
  local.get $rootOffset
  local.set $root
  local.get $root
  i32.const 0
  call $~lib/rt/tlsf/Root#set:flMap
  local.get $root
  local.set $root|4
  i32.const 0
  local.set $tail
  local.get $root|4
  local.get $tail
  i32.store offset=1568
  i32.const 0
  local.set $fl
  loop $for-loop|0
   local.get $fl
   i32.const 23
   i32.lt_u
   if
    local.get $root
    local.set $root|7
    local.get $fl
    local.set $fl|8
    i32.const 0
    local.set $slMap
    local.get $root|7
    local.get $fl|8
    i32.const 2
    i32.shl
    i32.add
    local.get $slMap
    i32.store offset=4
    i32.const 0
    local.set $sl
    loop $for-loop|1
     local.get $sl
     i32.const 16
     i32.lt_u
     if
      local.get $root
      local.set $root|11
      local.get $fl
      local.set $fl|12
      local.get $sl
      local.set $sl|13
      i32.const 0
      local.set $head
      local.get $root|11
      local.get $fl|12
      i32.const 4
      i32.shl
      local.get $sl|13
      i32.add
      i32.const 2
      i32.shl
      i32.add
      local.get $head
      i32.store offset=96
      local.get $sl
      i32.const 1
      i32.add
      local.set $sl
      br $for-loop|1
     end
    end
    local.get $fl
    i32.const 1
    i32.add
    local.set $fl
    br $for-loop|0
   end
  end
  local.get $rootOffset
  i32.const 1572
  i32.add
  local.set $memStart
  i32.const 0
  drop
  local.get $root
  local.get $memStart
  memory.size
  i64.extend_i32_s
  i64.const 16
  i64.shl
  call $~lib/rt/tlsf/addMemory
  drop
  local.get $root
  global.set $~lib/rt/tlsf/ROOT
 )
 (func $~lib/rt/tlsf/checkUsedBlock (param $ptr i32) (result i32)
  (local $block i32)
  local.get $ptr
  i32.const 4
  i32.sub
  local.set $block
  local.get $ptr
  i32.const 0
  i32.ne
  if (result i32)
   local.get $ptr
   i32.const 15
   i32.and
   i32.eqz
  else
   i32.const 0
  end
  if (result i32)
   local.get $block
   call $~lib/rt/common/BLOCK#get:mmInfo
   i32.const 1
   i32.and
   i32.eqz
  else
   i32.const 0
  end
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 562
   i32.const 3
   call $~lib/builtins/abort
   unreachable
  end
  local.get $block
  return
 )
 (func $~lib/rt/tlsf/freeBlock (param $root i32) (param $block i32)
  i32.const 0
  drop
  local.get $block
  local.get $block
  call $~lib/rt/common/BLOCK#get:mmInfo
  i32.const 1
  i32.or
  call $~lib/rt/common/BLOCK#set:mmInfo
  local.get $root
  local.get $block
  call $~lib/rt/tlsf/insertBlock
 )
 (func $~lib/rt/tlsf/__free (param $ptr i32)
  local.get $ptr
  global.get $~lib/memory/__heap_base
  i32.lt_u
  if
   return
  end
  global.get $~lib/rt/tlsf/ROOT
  i32.eqz
  if
   call $~lib/rt/tlsf/initialize
  end
  global.get $~lib/rt/tlsf/ROOT
  local.get $ptr
  call $~lib/rt/tlsf/checkUsedBlock
  call $~lib/rt/tlsf/freeBlock
 )
 (func $~lib/rt/itcms/free (param $obj i32)
  local.get $obj
  global.get $~lib/memory/__heap_base
  i32.lt_u
  if
   local.get $obj
   i32.const 0
   call $~lib/rt/itcms/Object#set:nextWithColor
   local.get $obj
   i32.const 0
   call $~lib/rt/itcms/Object#set:prev
  else
   global.get $~lib/rt/itcms/total
   local.get $obj
   call $~lib/rt/itcms/Object#get:size
   i32.sub
   global.set $~lib/rt/itcms/total
   i32.const 0
   drop
   local.get $obj
   i32.const 4
   i32.add
   call $~lib/rt/tlsf/__free
  end
 )
 (func $~lib/rt/itcms/step (result i32)
  (local $obj i32)
  (local $1 i32)
  (local $black i32)
  (local $from i32)
  block $break|0
   block $case2|0
    block $case1|0
     block $case0|0
      global.get $~lib/rt/itcms/state
      local.set $1
      local.get $1
      i32.const 0
      i32.eq
      br_if $case0|0
      local.get $1
      i32.const 1
      i32.eq
      br_if $case1|0
      local.get $1
      i32.const 2
      i32.eq
      br_if $case2|0
      br $break|0
     end
     i32.const 1
     global.set $~lib/rt/itcms/state
     i32.const 0
     global.set $~lib/rt/itcms/visitCount
     i32.const 0
     call $~lib/rt/itcms/visitRoots
     global.get $~lib/rt/itcms/toSpace
     global.set $~lib/rt/itcms/iter
     global.get $~lib/rt/itcms/visitCount
     i32.const 1
     i32.mul
     return
    end
    global.get $~lib/rt/itcms/white
    i32.eqz
    local.set $black
    global.get $~lib/rt/itcms/iter
    call $~lib/rt/itcms/Object#get:next
    local.set $obj
    loop $while-continue|1
     local.get $obj
     global.get $~lib/rt/itcms/toSpace
     i32.ne
     if
      local.get $obj
      global.set $~lib/rt/itcms/iter
      local.get $obj
      call $~lib/rt/itcms/Object#get:color
      local.get $black
      i32.ne
      if
       local.get $obj
       local.get $black
       call $~lib/rt/itcms/Object#set:color
       i32.const 0
       global.set $~lib/rt/itcms/visitCount
       local.get $obj
       i32.const 20
       i32.add
       i32.const 0
       call $~lib/rt/__visit_members
       global.get $~lib/rt/itcms/visitCount
       i32.const 1
       i32.mul
       return
      end
      local.get $obj
      call $~lib/rt/itcms/Object#get:next
      local.set $obj
      br $while-continue|1
     end
    end
    i32.const 0
    global.set $~lib/rt/itcms/visitCount
    i32.const 0
    call $~lib/rt/itcms/visitRoots
    global.get $~lib/rt/itcms/iter
    call $~lib/rt/itcms/Object#get:next
    local.set $obj
    local.get $obj
    global.get $~lib/rt/itcms/toSpace
    i32.eq
    if
     i32.const 0
     call $~lib/rt/itcms/visitStack
     global.get $~lib/rt/itcms/iter
     call $~lib/rt/itcms/Object#get:next
     local.set $obj
     loop $while-continue|2
      local.get $obj
      global.get $~lib/rt/itcms/toSpace
      i32.ne
      if
       local.get $obj
       call $~lib/rt/itcms/Object#get:color
       local.get $black
       i32.ne
       if
        local.get $obj
        local.get $black
        call $~lib/rt/itcms/Object#set:color
        local.get $obj
        i32.const 20
        i32.add
        i32.const 0
        call $~lib/rt/__visit_members
       end
       local.get $obj
       call $~lib/rt/itcms/Object#get:next
       local.set $obj
       br $while-continue|2
      end
     end
     global.get $~lib/rt/itcms/fromSpace
     local.set $from
     global.get $~lib/rt/itcms/toSpace
     global.set $~lib/rt/itcms/fromSpace
     local.get $from
     global.set $~lib/rt/itcms/toSpace
     local.get $black
     global.set $~lib/rt/itcms/white
     local.get $from
     call $~lib/rt/itcms/Object#get:next
     global.set $~lib/rt/itcms/iter
     i32.const 2
     global.set $~lib/rt/itcms/state
    end
    global.get $~lib/rt/itcms/visitCount
    i32.const 1
    i32.mul
    return
   end
   global.get $~lib/rt/itcms/iter
   local.set $obj
   local.get $obj
   global.get $~lib/rt/itcms/toSpace
   i32.ne
   if
    local.get $obj
    call $~lib/rt/itcms/Object#get:next
    global.set $~lib/rt/itcms/iter
    i32.const 1
    drop
    local.get $obj
    call $~lib/rt/itcms/Object#get:color
    global.get $~lib/rt/itcms/white
    i32.eqz
    i32.eq
    i32.eqz
    if
     i32.const 0
     i32.const 96
     i32.const 229
     i32.const 20
     call $~lib/builtins/abort
     unreachable
    end
    local.get $obj
    call $~lib/rt/itcms/free
    i32.const 10
    return
   end
   global.get $~lib/rt/itcms/toSpace
   global.get $~lib/rt/itcms/toSpace
   call $~lib/rt/itcms/Object#set:nextWithColor
   global.get $~lib/rt/itcms/toSpace
   global.get $~lib/rt/itcms/toSpace
   call $~lib/rt/itcms/Object#set:prev
   i32.const 0
   global.set $~lib/rt/itcms/state
   br $break|0
  end
  i32.const 0
  return
 )
 (func $~lib/rt/itcms/interrupt
  (local $budget i32)
  i32.const 0
  drop
  i32.const 0
  drop
  i32.const 1024
  i32.const 200
  i32.mul
  i32.const 100
  i32.div_u
  local.set $budget
  loop $do-loop|0
   local.get $budget
   call $~lib/rt/itcms/step
   i32.sub
   local.set $budget
   global.get $~lib/rt/itcms/state
   i32.const 0
   i32.eq
   if
    i32.const 0
    drop
    i32.const 200
    i32.const 100
    i32.rem_u
    i32.const 0
    i32.eq
    drop
    global.get $~lib/rt/itcms/total
    i32.const 200
    i32.const 100
    i32.div_u
    i32.mul
    i32.const 1024
    i32.add
    global.set $~lib/rt/itcms/threshold
    i32.const 0
    drop
    return
   end
   local.get $budget
   i32.const 0
   i32.gt_s
   br_if $do-loop|0
  end
  i32.const 0
  drop
  global.get $~lib/rt/itcms/total
  i32.const 1024
  global.get $~lib/rt/itcms/total
  global.get $~lib/rt/itcms/threshold
  i32.sub
  i32.const 1024
  i32.lt_u
  i32.mul
  i32.add
  global.set $~lib/rt/itcms/threshold
  i32.const 0
  drop
 )
 (func $~lib/rt/tlsf/computeSize (param $size i32) (result i32)
  local.get $size
  i32.const 12
  i32.le_u
  if (result i32)
   i32.const 12
  else
   local.get $size
   i32.const 4
   i32.add
   i32.const 15
   i32.add
   i32.const 15
   i32.const -1
   i32.xor
   i32.and
   i32.const 4
   i32.sub
  end
  return
 )
 (func $~lib/rt/tlsf/prepareSize (param $size i32) (result i32)
  local.get $size
  i32.const 1073741820
  i32.gt_u
  if
   i32.const 32
   i32.const 368
   i32.const 461
   i32.const 29
   call $~lib/builtins/abort
   unreachable
  end
  local.get $size
  call $~lib/rt/tlsf/computeSize
  return
 )
 (func $~lib/rt/tlsf/roundSize (param $size i32) (result i32)
  local.get $size
  i32.const 536870910
  i32.lt_u
  if (result i32)
   local.get $size
   i32.const 1
   i32.const 27
   local.get $size
   i32.clz
   i32.sub
   i32.shl
   i32.add
   i32.const 1
   i32.sub
  else
   local.get $size
  end
  return
 )
 (func $~lib/rt/tlsf/searchBlock (param $root i32) (param $size i32) (result i32)
  (local $fl i32)
  (local $sl i32)
  (local $requestSize i32)
  (local $root|5 i32)
  (local $fl|6 i32)
  (local $slMap i32)
  (local $head i32)
  (local $flMap i32)
  (local $root|10 i32)
  (local $fl|11 i32)
  (local $root|12 i32)
  (local $fl|13 i32)
  (local $sl|14 i32)
  (local $root|15 i32)
  (local $fl|16 i32)
  (local $sl|17 i32)
  local.get $size
  i32.const 256
  i32.lt_u
  if
   i32.const 0
   local.set $fl
   local.get $size
   i32.const 4
   i32.shr_u
   local.set $sl
  else
   local.get $size
   call $~lib/rt/tlsf/roundSize
   local.set $requestSize
   i32.const 4
   i32.const 8
   i32.mul
   i32.const 1
   i32.sub
   local.get $requestSize
   i32.clz
   i32.sub
   local.set $fl
   local.get $requestSize
   local.get $fl
   i32.const 4
   i32.sub
   i32.shr_u
   i32.const 1
   i32.const 4
   i32.shl
   i32.xor
   local.set $sl
   local.get $fl
   i32.const 8
   i32.const 1
   i32.sub
   i32.sub
   local.set $fl
  end
  i32.const 1
  drop
  local.get $fl
  i32.const 23
  i32.lt_u
  if (result i32)
   local.get $sl
   i32.const 16
   i32.lt_u
  else
   i32.const 0
  end
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 334
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  block $~lib/rt/tlsf/GETSL|inlined.2 (result i32)
   local.get $root
   local.set $root|5
   local.get $fl
   local.set $fl|6
   local.get $root|5
   local.get $fl|6
   i32.const 2
   i32.shl
   i32.add
   i32.load offset=4
   br $~lib/rt/tlsf/GETSL|inlined.2
  end
  i32.const 0
  i32.const -1
  i32.xor
  local.get $sl
  i32.shl
  i32.and
  local.set $slMap
  i32.const 0
  local.set $head
  local.get $slMap
  i32.eqz
  if
   local.get $root
   call $~lib/rt/tlsf/Root#get:flMap
   i32.const 0
   i32.const -1
   i32.xor
   local.get $fl
   i32.const 1
   i32.add
   i32.shl
   i32.and
   local.set $flMap
   local.get $flMap
   i32.eqz
   if
    i32.const 0
    local.set $head
   else
    local.get $flMap
    i32.ctz
    local.set $fl
    block $~lib/rt/tlsf/GETSL|inlined.3 (result i32)
     local.get $root
     local.set $root|10
     local.get $fl
     local.set $fl|11
     local.get $root|10
     local.get $fl|11
     i32.const 2
     i32.shl
     i32.add
     i32.load offset=4
     br $~lib/rt/tlsf/GETSL|inlined.3
    end
    local.set $slMap
    i32.const 1
    drop
    local.get $slMap
    i32.eqz
    if
     i32.const 0
     i32.const 368
     i32.const 347
     i32.const 18
     call $~lib/builtins/abort
     unreachable
    end
    block $~lib/rt/tlsf/GETHEAD|inlined.2 (result i32)
     local.get $root
     local.set $root|12
     local.get $fl
     local.set $fl|13
     local.get $slMap
     i32.ctz
     local.set $sl|14
     local.get $root|12
     local.get $fl|13
     i32.const 4
     i32.shl
     local.get $sl|14
     i32.add
     i32.const 2
     i32.shl
     i32.add
     i32.load offset=96
     br $~lib/rt/tlsf/GETHEAD|inlined.2
    end
    local.set $head
   end
  else
   block $~lib/rt/tlsf/GETHEAD|inlined.3 (result i32)
    local.get $root
    local.set $root|15
    local.get $fl
    local.set $fl|16
    local.get $slMap
    i32.ctz
    local.set $sl|17
    local.get $root|15
    local.get $fl|16
    i32.const 4
    i32.shl
    local.get $sl|17
    i32.add
    i32.const 2
    i32.shl
    i32.add
    i32.load offset=96
    br $~lib/rt/tlsf/GETHEAD|inlined.3
   end
   local.set $head
  end
  local.get $head
  return
 )
 (func $~lib/rt/tlsf/growMemory (param $root i32) (param $size i32)
  (local $pagesBefore i32)
  (local $root|3 i32)
  (local $pagesNeeded i32)
  (local $5 i32)
  (local $6 i32)
  (local $pagesWanted i32)
  (local $pagesAfter i32)
  i32.const 0
  drop
  local.get $size
  i32.const 256
  i32.ge_u
  if
   local.get $size
   call $~lib/rt/tlsf/roundSize
   local.set $size
  end
  memory.size
  local.set $pagesBefore
  local.get $size
  i32.const 4
  local.get $pagesBefore
  i32.const 16
  i32.shl
  i32.const 4
  i32.sub
  block $~lib/rt/tlsf/GETTAIL|inlined.1 (result i32)
   local.get $root
   local.set $root|3
   local.get $root|3
   i32.load offset=1568
   br $~lib/rt/tlsf/GETTAIL|inlined.1
  end
  i32.ne
  i32.shl
  i32.add
  local.set $size
  local.get $size
  i32.const 65535
  i32.add
  i32.const 65535
  i32.const -1
  i32.xor
  i32.and
  i32.const 16
  i32.shr_u
  local.set $pagesNeeded
  local.get $pagesBefore
  local.tee $5
  local.get $pagesNeeded
  local.tee $6
  local.get $5
  local.get $6
  i32.gt_s
  select
  local.set $pagesWanted
  local.get $pagesWanted
  memory.grow
  i32.const 0
  i32.lt_s
  if
   local.get $pagesNeeded
   memory.grow
   i32.const 0
   i32.lt_s
   if
    unreachable
   end
  end
  memory.size
  local.set $pagesAfter
  local.get $root
  local.get $pagesBefore
  i32.const 16
  i32.shl
  local.get $pagesAfter
  i64.extend_i32_s
  i64.const 16
  i64.shl
  call $~lib/rt/tlsf/addMemory
  drop
 )
 (func $~lib/rt/tlsf/prepareBlock (param $root i32) (param $block i32) (param $size i32)
  (local $blockInfo i32)
  (local $remaining i32)
  (local $spare i32)
  (local $block|6 i32)
  (local $block|7 i32)
  local.get $block
  call $~lib/rt/common/BLOCK#get:mmInfo
  local.set $blockInfo
  i32.const 1
  drop
  local.get $size
  i32.const 4
  i32.add
  i32.const 15
  i32.and
  i32.eqz
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 361
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $blockInfo
  i32.const 3
  i32.const -1
  i32.xor
  i32.and
  local.get $size
  i32.sub
  local.set $remaining
  local.get $remaining
  i32.const 4
  i32.const 12
  i32.add
  i32.ge_u
  if
   local.get $block
   local.get $size
   local.get $blockInfo
   i32.const 2
   i32.and
   i32.or
   call $~lib/rt/common/BLOCK#set:mmInfo
   local.get $block
   i32.const 4
   i32.add
   local.get $size
   i32.add
   local.set $spare
   local.get $spare
   local.get $remaining
   i32.const 4
   i32.sub
   i32.const 1
   i32.or
   call $~lib/rt/common/BLOCK#set:mmInfo
   local.get $root
   local.get $spare
   call $~lib/rt/tlsf/insertBlock
  else
   local.get $block
   local.get $blockInfo
   i32.const 1
   i32.const -1
   i32.xor
   i32.and
   call $~lib/rt/common/BLOCK#set:mmInfo
   block $~lib/rt/tlsf/GETRIGHT|inlined.3 (result i32)
    local.get $block
    local.set $block|7
    local.get $block|7
    i32.const 4
    i32.add
    local.get $block|7
    call $~lib/rt/common/BLOCK#get:mmInfo
    i32.const 3
    i32.const -1
    i32.xor
    i32.and
    i32.add
    br $~lib/rt/tlsf/GETRIGHT|inlined.3
   end
   block $~lib/rt/tlsf/GETRIGHT|inlined.2 (result i32)
    local.get $block
    local.set $block|6
    local.get $block|6
    i32.const 4
    i32.add
    local.get $block|6
    call $~lib/rt/common/BLOCK#get:mmInfo
    i32.const 3
    i32.const -1
    i32.xor
    i32.and
    i32.add
    br $~lib/rt/tlsf/GETRIGHT|inlined.2
   end
   call $~lib/rt/common/BLOCK#get:mmInfo
   i32.const 2
   i32.const -1
   i32.xor
   i32.and
   call $~lib/rt/common/BLOCK#set:mmInfo
  end
 )
 (func $~lib/rt/tlsf/allocateBlock (param $root i32) (param $size i32) (result i32)
  (local $payloadSize i32)
  (local $block i32)
  local.get $size
  call $~lib/rt/tlsf/prepareSize
  local.set $payloadSize
  local.get $root
  local.get $payloadSize
  call $~lib/rt/tlsf/searchBlock
  local.set $block
  local.get $block
  i32.eqz
  if
   local.get $root
   local.get $payloadSize
   call $~lib/rt/tlsf/growMemory
   local.get $root
   local.get $payloadSize
   call $~lib/rt/tlsf/searchBlock
   local.set $block
   i32.const 1
   drop
   local.get $block
   i32.eqz
   if
    i32.const 0
    i32.const 368
    i32.const 499
    i32.const 16
    call $~lib/builtins/abort
    unreachable
   end
  end
  i32.const 1
  drop
  local.get $block
  call $~lib/rt/common/BLOCK#get:mmInfo
  i32.const 3
  i32.const -1
  i32.xor
  i32.and
  local.get $payloadSize
  i32.ge_u
  i32.eqz
  if
   i32.const 0
   i32.const 368
   i32.const 501
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $root
  local.get $block
  call $~lib/rt/tlsf/removeBlock
  local.get $root
  local.get $block
  local.get $payloadSize
  call $~lib/rt/tlsf/prepareBlock
  i32.const 0
  drop
  local.get $block
  return
 )
 (func $~lib/rt/tlsf/__alloc (param $size i32) (result i32)
  global.get $~lib/rt/tlsf/ROOT
  i32.eqz
  if
   call $~lib/rt/tlsf/initialize
  end
  global.get $~lib/rt/tlsf/ROOT
  local.get $size
  call $~lib/rt/tlsf/allocateBlock
  i32.const 4
  i32.add
  return
 )
 (func $~lib/rt/itcms/Object#set:rtId (param $this i32) (param $rtId i32)
  local.get $this
  local.get $rtId
  i32.store offset=12
 )
 (func $~lib/rt/itcms/Object#set:rtSize (param $this i32) (param $rtSize i32)
  local.get $this
  local.get $rtSize
  i32.store offset=16
 )
 (func $~lib/rt/itcms/__new (param $size i32) (param $id i32) (result i32)
  (local $obj i32)
  (local $ptr i32)
  local.get $size
  i32.const 1073741804
  i32.ge_u
  if
   i32.const 32
   i32.const 96
   i32.const 261
   i32.const 31
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/rt/itcms/total
  global.get $~lib/rt/itcms/threshold
  i32.ge_u
  if
   call $~lib/rt/itcms/interrupt
  end
  i32.const 16
  local.get $size
  i32.add
  call $~lib/rt/tlsf/__alloc
  i32.const 4
  i32.sub
  local.set $obj
  local.get $obj
  local.get $id
  call $~lib/rt/itcms/Object#set:rtId
  local.get $obj
  local.get $size
  call $~lib/rt/itcms/Object#set:rtSize
  local.get $obj
  global.get $~lib/rt/itcms/fromSpace
  global.get $~lib/rt/itcms/white
  call $~lib/rt/itcms/Object#linkTo
  global.get $~lib/rt/itcms/total
  local.get $obj
  call $~lib/rt/itcms/Object#get:size
  i32.add
  global.set $~lib/rt/itcms/total
  local.get $obj
  i32.const 20
  i32.add
  local.set $ptr
  local.get $ptr
  i32.const 0
  local.get $size
  memory.fill
  local.get $ptr
  return
 )
 (func $assembly/math/HSV#set:h (param $this i32) (param $h f32)
  local.get $this
  local.get $h
  f32.store
 )
 (func $assembly/math/HSV#set:s (param $this i32) (param $s f32)
  local.get $this
  local.get $s
  f32.store offset=4
 )
 (func $assembly/math/HSV#set:v (param $this i32) (param $v f32)
  local.get $this
  local.get $v
  f32.store offset=8
 )
 (func $assembly/math/RGB#set:r (param $this i32) (param $r f32)
  local.get $this
  local.get $r
  f32.store
 )
 (func $assembly/math/RGB#set:g (param $this i32) (param $g f32)
  local.get $this
  local.get $g
  f32.store offset=4
 )
 (func $assembly/math/RGB#set:b (param $this i32) (param $b f32)
  local.get $this
  local.get $b
  f32.store offset=8
 )
 (func $start:assembly/math
  memory.size
  i32.const 16
  i32.shl
  global.get $~lib/memory/__heap_base
  i32.sub
  i32.const 1
  i32.shr_u
  global.set $~lib/rt/itcms/threshold
  i32.const 144
  call $~lib/rt/itcms/initLazy
  global.set $~lib/rt/itcms/pinSpace
  i32.const 176
  call $~lib/rt/itcms/initLazy
  global.set $~lib/rt/itcms/toSpace
  i32.const 320
  call $~lib/rt/itcms/initLazy
  global.set $~lib/rt/itcms/fromSpace
  i32.const 0
  call $assembly/math/HSV#constructor
  global.set $assembly/math/_hsv
  i32.const 0
  call $assembly/math/RGB#constructor
  global.set $assembly/math/_rgb
 )
 (func $start:assembly/camera_raw
  call $start:assembly/math
 )
 (func $~lib/rt/__newBuffer (param $size i32) (param $id i32) (param $data i32) (result i32)
  (local $buffer i32)
  local.get $size
  local.get $id
  call $~lib/rt/itcms/__new
  local.set $buffer
  local.get $data
  if
   local.get $buffer
   local.get $data
   local.get $size
   memory.copy
  end
  local.get $buffer
  return
 )
 (func $~lib/rt/itcms/__link (param $parentPtr i32) (param $childPtr i32) (param $expectMultiple i32)
  (local $child i32)
  (local $parent i32)
  (local $parentColor i32)
  local.get $childPtr
  i32.eqz
  if
   return
  end
  i32.const 1
  drop
  local.get $parentPtr
  i32.eqz
  if
   i32.const 0
   i32.const 96
   i32.const 295
   i32.const 14
   call $~lib/builtins/abort
   unreachable
  end
  local.get $childPtr
  i32.const 20
  i32.sub
  local.set $child
  local.get $child
  call $~lib/rt/itcms/Object#get:color
  global.get $~lib/rt/itcms/white
  i32.eq
  if
   local.get $parentPtr
   i32.const 20
   i32.sub
   local.set $parent
   local.get $parent
   call $~lib/rt/itcms/Object#get:color
   local.set $parentColor
   local.get $parentColor
   global.get $~lib/rt/itcms/white
   i32.eqz
   i32.eq
   if
    local.get $expectMultiple
    if
     local.get $parent
     call $~lib/rt/itcms/Object#makeGray
    else
     local.get $child
     call $~lib/rt/itcms/Object#makeGray
    end
   else
    local.get $parentColor
    i32.const 3
    i32.eq
    if (result i32)
     global.get $~lib/rt/itcms/state
     i32.const 1
     i32.eq
    else
     i32.const 0
    end
    if
     local.get $child
     call $~lib/rt/itcms/Object#makeGray
    end
   end
  end
 )
 (func $~lib/array/Array<~lib/array/Array<i32>>#get:length_ (param $this i32) (result i32)
  local.get $this
  i32.load offset=12
 )
 (func $~lib/arraybuffer/ArrayBufferView#get:byteLength (param $this i32) (result i32)
  local.get $this
  i32.load offset=8
 )
 (func $~lib/arraybuffer/ArrayBufferView#get:buffer (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/rt/itcms/Object#get:rtSize (param $this i32) (result i32)
  local.get $this
  i32.load offset=16
 )
 (func $~lib/rt/itcms/__renew (param $oldPtr i32) (param $size i32) (result i32)
  (local $oldObj i32)
  (local $newPtr i32)
  (local $4 i32)
  (local $5 i32)
  local.get $oldPtr
  i32.const 20
  i32.sub
  local.set $oldObj
  local.get $size
  local.get $oldObj
  call $~lib/rt/common/BLOCK#get:mmInfo
  i32.const 3
  i32.const -1
  i32.xor
  i32.and
  i32.const 16
  i32.sub
  i32.le_u
  if
   local.get $oldObj
   local.get $size
   call $~lib/rt/itcms/Object#set:rtSize
   local.get $oldPtr
   return
  end
  local.get $size
  local.get $oldObj
  call $~lib/rt/itcms/Object#get:rtId
  call $~lib/rt/itcms/__new
  local.set $newPtr
  local.get $newPtr
  local.get $oldPtr
  local.get $size
  local.tee $4
  local.get $oldObj
  call $~lib/rt/itcms/Object#get:rtSize
  local.tee $5
  local.get $4
  local.get $5
  i32.lt_u
  select
  memory.copy
  local.get $newPtr
  return
 )
 (func $~lib/array/Array<~lib/array/Array<i32>>#set:length_ (param $this i32) (param $length_ i32)
  local.get $this
  local.get $length_
  i32.store offset=12
 )
 (func $~lib/array/Array<~lib/array/Array<i32>>#get:dataStart (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $start:assembly/filters
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.const 2
  i32.const 7
  i32.const 0
  call $~lib/rt/__newArray
  local.tee $0
  i32.store
  local.get $0
  i32.const 0
  i32.const 8
  i32.const 2
  i32.const 6
  i32.const 432
  call $~lib/rt/__newArray
  call $~lib/array/Array<~lib/array/Array<i32>>#__set
  local.get $0
  i32.const 1
  i32.const 8
  i32.const 2
  i32.const 6
  i32.const 496
  call $~lib/rt/__newArray
  call $~lib/array/Array<~lib/array/Array<i32>>#__set
  local.get $0
  i32.const 2
  i32.const 8
  i32.const 2
  i32.const 6
  i32.const 560
  call $~lib/rt/__newArray
  call $~lib/array/Array<~lib/array/Array<i32>>#__set
  local.get $0
  i32.const 3
  i32.const 8
  i32.const 2
  i32.const 6
  i32.const 624
  call $~lib/rt/__newArray
  call $~lib/array/Array<~lib/array/Array<i32>>#__set
  local.get $0
  i32.const 4
  i32.const 8
  i32.const 2
  i32.const 6
  i32.const 688
  call $~lib/rt/__newArray
  call $~lib/array/Array<~lib/array/Array<i32>>#__set
  local.get $0
  i32.const 5
  i32.const 8
  i32.const 2
  i32.const 6
  i32.const 752
  call $~lib/rt/__newArray
  call $~lib/array/Array<~lib/array/Array<i32>>#__set
  local.get $0
  i32.const 6
  i32.const 8
  i32.const 2
  i32.const 6
  i32.const 816
  call $~lib/rt/__newArray
  call $~lib/array/Array<~lib/array/Array<i32>>#__set
  local.get $0
  i32.const 7
  i32.const 8
  i32.const 2
  i32.const 6
  i32.const 880
  call $~lib/rt/__newArray
  call $~lib/array/Array<~lib/array/Array<i32>>#__set
  local.get $0
  global.set $assembly/filters/BAYER_MATRIX
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $start:assembly/index
  call $start:assembly/camera_raw
  call $start:assembly/filters
 )
 (func $~lib/arraybuffer/ArrayBufferView#set:buffer (param $this i32) (param $buffer i32)
  local.get $this
  local.get $buffer
  i32.store
  local.get $this
  local.get $buffer
  i32.const 0
  call $~lib/rt/itcms/__link
 )
 (func $~lib/arraybuffer/ArrayBufferView#set:dataStart (param $this i32) (param $dataStart i32)
  local.get $this
  local.get $dataStart
  i32.store offset=4
 )
 (func $~lib/arraybuffer/ArrayBufferView#set:byteLength (param $this i32) (param $byteLength i32)
  local.get $this
  local.get $byteLength
  i32.store offset=8
 )
 (func $assembly/index/createBuffer (param $size i32) (result i32)
  i32.const 0
  local.get $size
  call $~lib/typedarray/Uint8Array#constructor
  return
 )
 (func $~lib/math/NativeMath.pow (param $x f64) (param $y f64) (result f64)
  (local $x|2 f64)
  (local $y|3 f64)
  (local $sign_bias i32)
  (local $ix i64)
  (local $iy i64)
  (local $topx i64)
  (local $topy i64)
  (local $u i64)
  (local $u|10 i64)
  (local $x2 f64)
  (local $iy|12 i64)
  (local $e i64)
  (local $iy|14 i64)
  (local $e|15 i64)
  (local $yint i32)
  (local $ix|17 i64)
  (local $tmp i64)
  (local $i i32)
  (local $k i64)
  (local $iz i64)
  (local $z f64)
  (local $kd f64)
  (local $invc f64)
  (local $logc f64)
  (local $logctail f64)
  (local $zhi f64)
  (local $zlo f64)
  (local $rhi f64)
  (local $rlo f64)
  (local $r f64)
  (local $t1 f64)
  (local $t2 f64)
  (local $lo1 f64)
  (local $lo2 f64)
  (local $ar f64)
  (local $ar2 f64)
  (local $ar3 f64)
  (local $arhi f64)
  (local $arhi2 f64)
  (local $hi f64)
  (local $lo3 f64)
  (local $lo4 f64)
  (local $p f64)
  (local $lo f64)
  (local $y|46 f64)
  (local $hi|47 f64)
  (local $lo|48 f64)
  (local $ehi f64)
  (local $elo f64)
  (local $yhi f64)
  (local $ylo f64)
  (local $lhi f64)
  (local $llo f64)
  (local $x|55 f64)
  (local $xtail f64)
  (local $sign_bias|57 i32)
  (local $abstop i32)
  (local $ki i64)
  (local $top i64)
  (local $sbits i64)
  (local $idx i32)
  (local $kd|63 f64)
  (local $z|64 f64)
  (local $r|65 f64)
  (local $r2 f64)
  (local $scale f64)
  (local $tail f64)
  (local $tmp|69 f64)
  (local $ux i64)
  (local $sign i32)
  (local $sign|72 i32)
  (local $y|73 f64)
  (local $sign|74 i32)
  (local $sign|75 i32)
  (local $y|76 f64)
  (local $tmp|77 f64)
  (local $sbits|78 i64)
  (local $ki|79 i64)
  (local $scale|80 f64)
  (local $y|81 f64)
  (local $one f64)
  (local $lo|83 f64)
  (local $hi|84 f64)
  local.get $y
  f64.abs
  f64.const 2
  f64.le
  if
   local.get $y
   f64.const 2
   f64.eq
   if
    local.get $x
    local.get $x
    f64.mul
    return
   end
   local.get $y
   f64.const 0.5
   f64.eq
   if
    local.get $x
    f64.sqrt
    f64.abs
    f64.const inf
    local.get $x
    f64.const inf
    f64.neg
    f64.ne
    select
    return
   end
   local.get $y
   f64.const -1
   f64.eq
   if
    f64.const 1
    local.get $x
    f64.div
    return
   end
   local.get $y
   f64.const 1
   f64.eq
   if
    local.get $x
    return
   end
   local.get $y
   f64.const 0
   f64.eq
   if
    f64.const 1
    return
   end
  end
  i32.const 0
  i32.const 1
  i32.lt_s
  drop
  block $~lib/util/math/pow_lut|inlined.0 (result f64)
   local.get $x
   local.set $x|2
   local.get $y
   local.set $y|3
   i32.const 0
   local.set $sign_bias
   local.get $x|2
   i64.reinterpret_f64
   local.set $ix
   local.get $y|3
   i64.reinterpret_f64
   local.set $iy
   local.get $ix
   i64.const 52
   i64.shr_u
   local.set $topx
   local.get $iy
   i64.const 52
   i64.shr_u
   local.set $topy
   local.get $topx
   i64.const 1
   i64.sub
   i64.const 2047
   i64.const 1
   i64.sub
   i64.ge_u
   if (result i32)
    i32.const 1
   else
    local.get $topy
    i64.const 2047
    i64.and
    i64.const 958
    i64.sub
    i64.const 1086
    i64.const 958
    i64.sub
    i64.ge_u
   end
   if
    block $~lib/util/math/zeroinfnan|inlined.0 (result i32)
     local.get $iy
     local.set $u
     local.get $u
     i64.const 1
     i64.shl
     i64.const 1
     i64.sub
     i64.const -9007199254740992
     i64.const 1
     i64.sub
     i64.ge_u
     br $~lib/util/math/zeroinfnan|inlined.0
    end
    if
     local.get $iy
     i64.const 1
     i64.shl
     i64.const 0
     i64.eq
     if
      f64.const 1
      br $~lib/util/math/pow_lut|inlined.0
     end
     local.get $ix
     i64.const 4607182418800017408
     i64.eq
     if
      f64.const nan:0x8000000000000
      br $~lib/util/math/pow_lut|inlined.0
     end
     local.get $ix
     i64.const 1
     i64.shl
     i64.const -9007199254740992
     i64.gt_u
     if (result i32)
      i32.const 1
     else
      local.get $iy
      i64.const 1
      i64.shl
      i64.const -9007199254740992
      i64.gt_u
     end
     if
      local.get $x|2
      local.get $y|3
      f64.add
      br $~lib/util/math/pow_lut|inlined.0
     end
     local.get $ix
     i64.const 1
     i64.shl
     i64.const 9214364837600034816
     i64.eq
     if
      f64.const nan:0x8000000000000
      br $~lib/util/math/pow_lut|inlined.0
     end
     local.get $ix
     i64.const 1
     i64.shl
     i64.const 9214364837600034816
     i64.lt_u
     local.get $iy
     i64.const 63
     i64.shr_u
     i64.const 0
     i64.ne
     i32.eqz
     i32.eq
     if
      f64.const 0
      br $~lib/util/math/pow_lut|inlined.0
     end
     local.get $y|3
     local.get $y|3
     f64.mul
     br $~lib/util/math/pow_lut|inlined.0
    end
    block $~lib/util/math/zeroinfnan|inlined.1 (result i32)
     local.get $ix
     local.set $u|10
     local.get $u|10
     i64.const 1
     i64.shl
     i64.const 1
     i64.sub
     i64.const -9007199254740992
     i64.const 1
     i64.sub
     i64.ge_u
     br $~lib/util/math/zeroinfnan|inlined.1
    end
    if
     local.get $x|2
     local.get $x|2
     f64.mul
     local.set $x2
     local.get $ix
     i64.const 63
     i64.shr_u
     i32.wrap_i64
     if (result i32)
      block $~lib/util/math/checkint|inlined.0 (result i32)
       local.get $iy
       local.set $iy|12
       local.get $iy|12
       i64.const 52
       i64.shr_u
       i64.const 2047
       i64.and
       local.set $e
       local.get $e
       i64.const 1023
       i64.lt_u
       if
        i32.const 0
        br $~lib/util/math/checkint|inlined.0
       end
       local.get $e
       i64.const 1023
       i64.const 52
       i64.add
       i64.gt_u
       if
        i32.const 2
        br $~lib/util/math/checkint|inlined.0
       end
       i64.const 1
       i64.const 1023
       i64.const 52
       i64.add
       local.get $e
       i64.sub
       i64.shl
       local.set $e
       local.get $iy|12
       local.get $e
       i64.const 1
       i64.sub
       i64.and
       i64.const 0
       i64.ne
       if
        i32.const 0
        br $~lib/util/math/checkint|inlined.0
       end
       local.get $iy|12
       local.get $e
       i64.and
       i64.const 0
       i64.ne
       if
        i32.const 1
        br $~lib/util/math/checkint|inlined.0
       end
       i32.const 2
       br $~lib/util/math/checkint|inlined.0
      end
      i32.const 1
      i32.eq
     else
      i32.const 0
     end
     if
      local.get $x2
      f64.neg
      local.set $x2
     end
     local.get $iy
     i64.const 0
     i64.lt_s
     if (result f64)
      f64.const 1
      local.get $x2
      f64.div
     else
      local.get $x2
     end
     br $~lib/util/math/pow_lut|inlined.0
    end
    local.get $ix
    i64.const 0
    i64.lt_s
    if
     block $~lib/util/math/checkint|inlined.1 (result i32)
      local.get $iy
      local.set $iy|14
      local.get $iy|14
      i64.const 52
      i64.shr_u
      i64.const 2047
      i64.and
      local.set $e|15
      local.get $e|15
      i64.const 1023
      i64.lt_u
      if
       i32.const 0
       br $~lib/util/math/checkint|inlined.1
      end
      local.get $e|15
      i64.const 1023
      i64.const 52
      i64.add
      i64.gt_u
      if
       i32.const 2
       br $~lib/util/math/checkint|inlined.1
      end
      i64.const 1
      i64.const 1023
      i64.const 52
      i64.add
      local.get $e|15
      i64.sub
      i64.shl
      local.set $e|15
      local.get $iy|14
      local.get $e|15
      i64.const 1
      i64.sub
      i64.and
      i64.const 0
      i64.ne
      if
       i32.const 0
       br $~lib/util/math/checkint|inlined.1
      end
      local.get $iy|14
      local.get $e|15
      i64.and
      i64.const 0
      i64.ne
      if
       i32.const 1
       br $~lib/util/math/checkint|inlined.1
      end
      i32.const 2
      br $~lib/util/math/checkint|inlined.1
     end
     local.set $yint
     local.get $yint
     i32.const 0
     i32.eq
     if
      local.get $x|2
      local.get $x|2
      f64.sub
      local.get $x|2
      local.get $x|2
      f64.sub
      f64.div
      br $~lib/util/math/pow_lut|inlined.0
     end
     local.get $yint
     i32.const 1
     i32.eq
     if
      i32.const 262144
      local.set $sign_bias
     end
     local.get $ix
     i64.const 9223372036854775807
     i64.and
     local.set $ix
     local.get $topx
     i64.const 2047
     i64.and
     local.set $topx
    end
    local.get $topy
    i64.const 2047
    i64.and
    i64.const 958
    i64.sub
    i64.const 1086
    i64.const 958
    i64.sub
    i64.ge_u
    if
     local.get $ix
     i64.const 4607182418800017408
     i64.eq
     if
      f64.const 1
      br $~lib/util/math/pow_lut|inlined.0
     end
     local.get $topy
     i64.const 2047
     i64.and
     i64.const 958
     i64.lt_u
     if
      f64.const 1
      br $~lib/util/math/pow_lut|inlined.0
     end
     local.get $ix
     i64.const 4607182418800017408
     i64.gt_u
     local.get $topy
     i64.const 2048
     i64.lt_u
     i32.eq
     if (result f64)
      f64.const inf
     else
      f64.const 0
     end
     br $~lib/util/math/pow_lut|inlined.0
    end
    local.get $topx
    i64.const 0
    i64.eq
    if
     local.get $x|2
     f64.const 4503599627370496
     f64.mul
     i64.reinterpret_f64
     local.set $ix
     local.get $ix
     i64.const 9223372036854775807
     i64.and
     local.set $ix
     local.get $ix
     i64.const 52
     i64.const 52
     i64.shl
     i64.sub
     local.set $ix
    end
   end
   block $~lib/util/math/log_inline|inlined.0 (result f64)
    local.get $ix
    local.set $ix|17
    local.get $ix|17
    i64.const 4604531861337669632
    i64.sub
    local.set $tmp
    local.get $tmp
    i64.const 52
    i32.const 7
    i64.extend_i32_s
    i64.sub
    i64.shr_u
    i32.const 127
    i64.extend_i32_s
    i64.and
    i32.wrap_i64
    local.set $i
    local.get $tmp
    i64.const 52
    i64.shr_s
    local.set $k
    local.get $ix|17
    local.get $tmp
    i64.const 4095
    i64.const 52
    i64.shl
    i64.and
    i64.sub
    local.set $iz
    local.get $iz
    f64.reinterpret_i64
    local.set $z
    local.get $k
    f64.convert_i64_s
    local.set $kd
    i32.const 1088
    local.get $i
    i32.const 2
    i32.const 3
    i32.add
    i32.shl
    i32.add
    f64.load
    local.set $invc
    i32.const 1088
    local.get $i
    i32.const 2
    i32.const 3
    i32.add
    i32.shl
    i32.add
    f64.load offset=16
    local.set $logc
    i32.const 1088
    local.get $i
    i32.const 2
    i32.const 3
    i32.add
    i32.shl
    i32.add
    f64.load offset=24
    local.set $logctail
    local.get $iz
    i64.const 2147483648
    i64.add
    i64.const -4294967296
    i64.and
    f64.reinterpret_i64
    local.set $zhi
    local.get $z
    local.get $zhi
    f64.sub
    local.set $zlo
    local.get $zhi
    local.get $invc
    f64.mul
    f64.const 1
    f64.sub
    local.set $rhi
    local.get $zlo
    local.get $invc
    f64.mul
    local.set $rlo
    local.get $rhi
    local.get $rlo
    f64.add
    local.set $r
    local.get $kd
    f64.const 0.6931471805598903
    f64.mul
    local.get $logc
    f64.add
    local.set $t1
    local.get $t1
    local.get $r
    f64.add
    local.set $t2
    local.get $kd
    f64.const 5.497923018708371e-14
    f64.mul
    local.get $logctail
    f64.add
    local.set $lo1
    local.get $t1
    local.get $t2
    f64.sub
    local.get $r
    f64.add
    local.set $lo2
    f64.const -0.5
    local.get $r
    f64.mul
    local.set $ar
    local.get $r
    local.get $ar
    f64.mul
    local.set $ar2
    local.get $r
    local.get $ar2
    f64.mul
    local.set $ar3
    f64.const -0.5
    local.get $rhi
    f64.mul
    local.set $arhi
    local.get $rhi
    local.get $arhi
    f64.mul
    local.set $arhi2
    local.get $t2
    local.get $arhi2
    f64.add
    local.set $hi
    local.get $rlo
    local.get $ar
    local.get $arhi
    f64.add
    f64.mul
    local.set $lo3
    local.get $t2
    local.get $hi
    f64.sub
    local.get $arhi2
    f64.add
    local.set $lo4
    local.get $ar3
    f64.const -0.6666666666666679
    local.get $r
    f64.const 0.5000000000000007
    f64.mul
    f64.add
    local.get $ar2
    f64.const 0.7999999995323976
    local.get $r
    f64.const -0.6666666663487739
    f64.mul
    f64.add
    local.get $ar2
    f64.const -1.142909628459501
    local.get $r
    f64.const 1.0000415263675542
    f64.mul
    f64.add
    f64.mul
    f64.add
    f64.mul
    f64.add
    f64.mul
    local.set $p
    local.get $lo1
    local.get $lo2
    f64.add
    local.get $lo3
    f64.add
    local.get $lo4
    f64.add
    local.get $p
    f64.add
    local.set $lo
    local.get $hi
    local.get $lo
    f64.add
    local.set $y|46
    local.get $hi
    local.get $y|46
    f64.sub
    local.get $lo
    f64.add
    global.set $~lib/util/math/log_tail
    local.get $y|46
    br $~lib/util/math/log_inline|inlined.0
   end
   local.set $hi|47
   global.get $~lib/util/math/log_tail
   local.set $lo|48
   local.get $iy
   i64.const -134217728
   i64.and
   f64.reinterpret_i64
   local.set $yhi
   local.get $y|3
   local.get $yhi
   f64.sub
   local.set $ylo
   local.get $hi|47
   i64.reinterpret_f64
   i64.const -134217728
   i64.and
   f64.reinterpret_i64
   local.set $lhi
   local.get $hi|47
   local.get $lhi
   f64.sub
   local.get $lo|48
   f64.add
   local.set $llo
   local.get $yhi
   local.get $lhi
   f64.mul
   local.set $ehi
   local.get $ylo
   local.get $lhi
   f64.mul
   local.get $y|3
   local.get $llo
   f64.mul
   f64.add
   local.set $elo
   block $~lib/util/math/exp_inline|inlined.0 (result f64)
    local.get $ehi
    local.set $x|55
    local.get $elo
    local.set $xtail
    local.get $sign_bias
    local.set $sign_bias|57
    local.get $x|55
    i64.reinterpret_f64
    local.set $ux
    local.get $ux
    i64.const 52
    i64.shr_u
    i32.wrap_i64
    i32.const 2047
    i32.and
    local.set $abstop
    local.get $abstop
    i32.const 969
    i32.sub
    i32.const 63
    i32.ge_u
    if
     local.get $abstop
     i32.const 969
     i32.sub
     i32.const -2147483648
     i32.ge_u
     if
      f64.const -1
      f64.const 1
      local.get $sign_bias|57
      select
      br $~lib/util/math/exp_inline|inlined.0
     end
     local.get $abstop
     i32.const 1033
     i32.ge_u
     if
      local.get $ux
      i64.const 0
      i64.lt_s
      if (result f64)
       block $~lib/util/math/uflow|inlined.0 (result f64)
        local.get $sign_bias|57
        local.set $sign
        block $~lib/util/math/xflow|inlined.0 (result f64)
         local.get $sign
         local.set $sign|72
         i64.const 1152921504606846976
         f64.reinterpret_i64
         local.set $y|73
         local.get $y|73
         f64.neg
         local.get $y|73
         local.get $sign|72
         select
         local.get $y|73
         f64.mul
         br $~lib/util/math/xflow|inlined.0
        end
        br $~lib/util/math/uflow|inlined.0
       end
      else
       block $~lib/util/math/oflow|inlined.0 (result f64)
        local.get $sign_bias|57
        local.set $sign|74
        block $~lib/util/math/xflow|inlined.1 (result f64)
         local.get $sign|74
         local.set $sign|75
         i64.const 8070450532247928832
         f64.reinterpret_i64
         local.set $y|76
         local.get $y|76
         f64.neg
         local.get $y|76
         local.get $sign|75
         select
         local.get $y|76
         f64.mul
         br $~lib/util/math/xflow|inlined.1
        end
        br $~lib/util/math/oflow|inlined.0
       end
      end
      br $~lib/util/math/exp_inline|inlined.0
     end
     i32.const 0
     local.set $abstop
    end
    f64.const 184.6649652337873
    local.get $x|55
    f64.mul
    local.set $z|64
    local.get $z|64
    f64.const 6755399441055744
    f64.add
    local.set $kd|63
    local.get $kd|63
    i64.reinterpret_f64
    local.set $ki
    local.get $kd|63
    f64.const 6755399441055744
    f64.sub
    local.set $kd|63
    local.get $x|55
    local.get $kd|63
    f64.const -0.005415212348111709
    f64.mul
    f64.add
    local.get $kd|63
    f64.const -1.2864023111638346e-14
    f64.mul
    f64.add
    local.set $r|65
    local.get $r|65
    local.get $xtail
    f64.add
    local.set $r|65
    local.get $ki
    i32.const 127
    i64.extend_i32_s
    i64.and
    i64.const 1
    i64.shl
    i32.wrap_i64
    local.set $idx
    local.get $ki
    local.get $sign_bias|57
    i64.extend_i32_u
    i64.add
    i64.const 52
    i32.const 7
    i64.extend_i32_s
    i64.sub
    i64.shl
    local.set $top
    i32.const 5184
    local.get $idx
    i32.const 3
    i32.shl
    i32.add
    i64.load
    f64.reinterpret_i64
    local.set $tail
    i32.const 5184
    local.get $idx
    i32.const 3
    i32.shl
    i32.add
    i64.load offset=8
    local.get $top
    i64.add
    local.set $sbits
    local.get $r|65
    local.get $r|65
    f64.mul
    local.set $r2
    local.get $tail
    local.get $r|65
    f64.add
    local.get $r2
    f64.const 0.49999999999996786
    local.get $r|65
    f64.const 0.16666666666665886
    f64.mul
    f64.add
    f64.mul
    f64.add
    local.get $r2
    local.get $r2
    f64.mul
    f64.const 0.0416666808410674
    local.get $r|65
    f64.const 0.008333335853059549
    f64.mul
    f64.add
    f64.mul
    f64.add
    local.set $tmp|69
    local.get $abstop
    i32.const 0
    i32.eq
    if
     block $~lib/util/math/specialcase|inlined.0 (result f64)
      local.get $tmp|69
      local.set $tmp|77
      local.get $sbits
      local.set $sbits|78
      local.get $ki
      local.set $ki|79
      local.get $ki|79
      i64.const 2147483648
      i64.and
      i64.const 0
      i64.ne
      i32.eqz
      if
       local.get $sbits|78
       i64.const 1009
       i64.const 52
       i64.shl
       i64.sub
       local.set $sbits|78
       local.get $sbits|78
       f64.reinterpret_i64
       local.set $scale|80
       f64.const 5486124068793688683255936e279
       local.get $scale|80
       local.get $scale|80
       local.get $tmp|77
       f64.mul
       f64.add
       f64.mul
       br $~lib/util/math/specialcase|inlined.0
      end
      local.get $sbits|78
      i64.const 1022
      i64.const 52
      i64.shl
      i64.add
      local.set $sbits|78
      local.get $sbits|78
      f64.reinterpret_i64
      local.set $scale|80
      local.get $scale|80
      local.get $scale|80
      local.get $tmp|77
      f64.mul
      f64.add
      local.set $y|81
      local.get $y|81
      f64.abs
      f64.const 1
      f64.lt
      if
       f64.const 1
       local.get $y|81
       f64.copysign
       local.set $one
       local.get $scale|80
       local.get $y|81
       f64.sub
       local.get $scale|80
       local.get $tmp|77
       f64.mul
       f64.add
       local.set $lo|83
       local.get $one
       local.get $y|81
       f64.add
       local.set $hi|84
       local.get $one
       local.get $hi|84
       f64.sub
       local.get $y|81
       f64.add
       local.get $lo|83
       f64.add
       local.set $lo|83
       local.get $hi|84
       local.get $lo|83
       f64.add
       local.get $one
       f64.sub
       local.set $y|81
       local.get $y|81
       f64.const 0
       f64.eq
       if
        local.get $sbits|78
        i64.const -9223372036854775808
        i64.and
        f64.reinterpret_i64
        local.set $y|81
       end
      end
      local.get $y|81
      f64.const 2.2250738585072014e-308
      f64.mul
      br $~lib/util/math/specialcase|inlined.0
     end
     br $~lib/util/math/exp_inline|inlined.0
    end
    local.get $sbits
    f64.reinterpret_i64
    local.set $scale
    local.get $scale
    local.get $scale
    local.get $tmp|69
    f64.mul
    f64.add
    br $~lib/util/math/exp_inline|inlined.0
   end
   br $~lib/util/math/pow_lut|inlined.0
  end
  return
 )
 (func $assembly/math/HSV#get:h (param $this i32) (result f32)
  local.get $this
  f32.load
 )
 (func $~lib/math/NativeMathf.mod (param $x f32) (param $y f32) (result f32)
  (local $ux i32)
  (local $uy i32)
  (local $ex i32)
  (local $ey i32)
  (local $sm i32)
  (local $uy1 i32)
  (local $m f32)
  (local $ux1 i32)
  (local $shift i32)
  local.get $y
  f32.abs
  f32.const 1
  f32.eq
  if
   local.get $x
   local.get $x
   f32.trunc
   f32.sub
   local.get $x
   f32.copysign
   return
  end
  local.get $x
  i32.reinterpret_f32
  local.set $ux
  local.get $y
  i32.reinterpret_f32
  local.set $uy
  local.get $ux
  i32.const 23
  i32.shr_u
  i32.const 255
  i32.and
  local.set $ex
  local.get $uy
  i32.const 23
  i32.shr_u
  i32.const 255
  i32.and
  local.set $ey
  local.get $ux
  i32.const -2147483648
  i32.and
  local.set $sm
  local.get $uy
  i32.const 1
  i32.shl
  local.set $uy1
  local.get $uy1
  i32.const 0
  i32.eq
  if (result i32)
   i32.const 1
  else
   local.get $ex
   i32.const 255
   i32.eq
  end
  if (result i32)
   i32.const 1
  else
   local.get $y
   local.get $y
   f32.ne
  end
  if
   local.get $x
   local.get $y
   f32.mul
   local.set $m
   local.get $m
   local.get $m
   f32.div
   return
  end
  local.get $ux
  i32.const 1
  i32.shl
  local.set $ux1
  local.get $ux1
  local.get $uy1
  i32.le_u
  if
   local.get $x
   local.get $ux1
   local.get $uy1
   i32.ne
   f32.convert_i32_u
   f32.mul
   return
  end
  local.get $ex
  i32.eqz
  if
   local.get $ex
   local.get $ux
   i32.const 9
   i32.shl
   i32.clz
   i32.sub
   local.set $ex
   local.get $ux
   i32.const 1
   local.get $ex
   i32.sub
   i32.shl
   local.set $ux
  else
   local.get $ux
   i32.const -1
   i32.const 9
   i32.shr_u
   i32.and
   local.set $ux
   local.get $ux
   i32.const 1
   i32.const 23
   i32.shl
   i32.or
   local.set $ux
  end
  local.get $ey
  i32.eqz
  if
   local.get $ey
   local.get $uy
   i32.const 9
   i32.shl
   i32.clz
   i32.sub
   local.set $ey
   local.get $uy
   i32.const 1
   local.get $ey
   i32.sub
   i32.shl
   local.set $uy
  else
   local.get $uy
   i32.const -1
   i32.const 9
   i32.shr_u
   i32.and
   local.set $uy
   local.get $uy
   i32.const 1
   i32.const 23
   i32.shl
   i32.or
   local.set $uy
  end
  loop $while-continue|0
   local.get $ex
   local.get $ey
   i32.gt_s
   if
    local.get $ux
    local.get $uy
    i32.ge_u
    if
     local.get $ux
     local.get $uy
     i32.eq
     if
      f32.const 0
      local.get $x
      f32.mul
      return
     end
     local.get $ux
     local.get $uy
     i32.sub
     local.set $ux
    end
    local.get $ux
    i32.const 1
    i32.shl
    local.set $ux
    local.get $ex
    i32.const 1
    i32.sub
    local.set $ex
    br $while-continue|0
   end
  end
  local.get $ux
  local.get $uy
  i32.ge_u
  if
   local.get $ux
   local.get $uy
   i32.eq
   if
    f32.const 0
    local.get $x
    f32.mul
    return
   end
   local.get $ux
   local.get $uy
   i32.sub
   local.set $ux
  end
  local.get $ux
  i32.const 8
  i32.shl
  i32.clz
  local.set $shift
  local.get $ex
  local.get $shift
  i32.sub
  local.set $ex
  local.get $ux
  local.get $shift
  i32.shl
  local.set $ux
  local.get $ex
  i32.const 0
  i32.gt_s
  if
   local.get $ux
   i32.const 1
   i32.const 23
   i32.shl
   i32.sub
   local.set $ux
   local.get $ux
   local.get $ex
   i32.const 23
   i32.shl
   i32.or
   local.set $ux
  else
   local.get $ux
   i32.const 0
   local.get $ex
   i32.sub
   i32.const 1
   i32.add
   i32.shr_u
   local.set $ux
  end
  local.get $ux
  local.get $sm
  i32.or
  f32.reinterpret_i32
  return
 )
 (func $assembly/math/HSV#get:s (param $this i32) (result f32)
  local.get $this
  f32.load offset=4
 )
 (func $assembly/math/HSV#get:v (param $this i32) (result f32)
  local.get $this
  f32.load offset=8
 )
 (func $assembly/math/RGB#get:r (param $this i32) (result f32)
  local.get $this
  f32.load
 )
 (func $assembly/math/RGB#get:g (param $this i32) (result f32)
  local.get $this
  f32.load offset=4
 )
 (func $assembly/math/RGB#get:b (param $this i32) (result f32)
  local.get $this
  f32.load offset=8
 )
 (func $assembly/camera_raw/generateThumbnail (param $srcPtr i32) (param $dstPtr i32) (param $srcW i32) (param $srcH i32) (param $dstW i32) (param $dstH i32)
  (local $xRatio f32)
  (local $yRatio f32)
  (local $y i32)
  (local $rowOffset i32)
  (local $srcY i32)
  (local $x i32)
  (local $srcX i32)
  (local $srcIdx i32)
  local.get $srcW
  f32.convert_i32_s
  local.get $dstW
  f32.convert_i32_s
  f32.div
  local.set $xRatio
  local.get $srcH
  f32.convert_i32_s
  local.get $dstH
  f32.convert_i32_s
  f32.div
  local.set $yRatio
  i32.const 0
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $dstH
   i32.lt_s
   if
    local.get $y
    local.get $dstW
    i32.mul
    i32.const 4
    i32.mul
    local.set $rowOffset
    local.get $y
    f32.convert_i32_s
    local.get $yRatio
    f32.mul
    i32.trunc_sat_f32_s
    local.set $srcY
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $dstW
     i32.lt_s
     if
      local.get $x
      f32.convert_i32_s
      local.get $xRatio
      f32.mul
      i32.trunc_sat_f32_s
      local.set $srcX
      local.get $srcY
      local.get $srcW
      i32.mul
      local.get $srcX
      i32.add
      i32.const 2
      i32.shl
      local.set $srcIdx
      local.get $dstPtr
      local.get $rowOffset
      i32.add
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      local.get $srcPtr
      local.get $srcIdx
      i32.add
      i32.load
      i32.store
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/chromatic (param $srcPtr i32) (param $dstPtr i32) (param $w i32) (param $h i32) (param $shift i32) (param $startY i32) (param $endY i32)
  (local $y i32)
  (local $row i32)
  (local $x i32)
  (local $idx i32)
  (local $value1 f64)
  (local $value2 f64)
  (local $rIdx i32)
  (local $value1|14 f64)
  (local $value2|15 f64)
  (local $bIdx i32)
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $w
     i32.lt_s
     if
      local.get $row
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      local.set $idx
      local.get $row
      block $~lib/math/NativeMath.max|inlined.11 (result f64)
       f64.const 0
       local.set $value1
       local.get $x
       local.get $shift
       i32.sub
       f64.convert_i32_s
       local.set $value2
       local.get $value1
       local.get $value2
       f64.max
       br $~lib/math/NativeMath.max|inlined.11
      end
      i32.trunc_sat_f64_u
      i32.const 2
      i32.shl
      i32.add
      local.set $rIdx
      local.get $row
      block $~lib/math/NativeMath.min|inlined.4 (result f64)
       local.get $w
       i32.const 1
       i32.sub
       f64.convert_i32_s
       local.set $value1|14
       local.get $x
       local.get $shift
       i32.add
       f64.convert_i32_s
       local.set $value2|15
       local.get $value1|14
       local.get $value2|15
       f64.min
       br $~lib/math/NativeMath.min|inlined.4
      end
      i32.trunc_sat_f64_u
      i32.const 2
      i32.shl
      i32.add
      local.set $bIdx
      local.get $dstPtr
      local.get $idx
      i32.add
      local.get $srcPtr
      local.get $rIdx
      i32.add
      i32.load8_u
      i32.store8
      local.get $dstPtr
      local.get $idx
      i32.add
      i32.const 1
      i32.add
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 1
      i32.add
      i32.load8_u
      i32.store8
      local.get $dstPtr
      local.get $idx
      i32.add
      i32.const 2
      i32.add
      local.get $srcPtr
      local.get $bIdx
      i32.add
      i32.load8_u
      i32.store8
      local.get $dstPtr
      local.get $idx
      i32.add
      i32.const 3
      i32.add
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 3
      i32.add
      i32.load8_u
      i32.store8
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $~lib/math/pio2_large_quot (param $x f64) (param $u i64) (result i32)
  (local $magnitude i64)
  (local $offset i64)
  (local $shift i64)
  (local $tblPtr i32)
  (local $s0 i64)
  (local $s1 i64)
  (local $s2 i64)
  (local $b0 i64)
  (local $b1 i64)
  (local $b2 i64)
  (local $rshift i64)
  (local $b3 i64)
  (local $significand i64)
  (local $u|15 i64)
  (local $v i64)
  (local $u1 i64)
  (local $v1 i64)
  (local $w0 i64)
  (local $w1 i64)
  (local $t i64)
  (local $blo i64)
  (local $bhi i64)
  (local $ahi i64)
  (local $clo i64)
  (local $plo i64)
  (local $phi i64)
  (local $rlo i64)
  (local $rhi i64)
  (local $slo i64)
  (local $shi i64)
  (local $q i64)
  (local $q0 i64)
  (local $q1 i64)
  (local $shift|35 i64)
  (local $u|36 i64)
  (local $v|37 i64)
  (local $u1|38 i64)
  (local $v1|39 i64)
  (local $w0|40 i64)
  (local $w1|41 i64)
  (local $t|42 i64)
  (local $lo i64)
  (local $hi i64)
  (local $ahi|45 i64)
  (local $alo i64)
  (local $blo|47 i64)
  (local $shifter i64)
  (local $signbit i64)
  (local $coeff f64)
  local.get $u
  i64.const 9223372036854775807
  i64.and
  local.set $magnitude
  local.get $magnitude
  i64.const 52
  i64.shr_s
  i64.const 1045
  i64.sub
  local.set $offset
  local.get $offset
  i64.const 63
  i64.and
  local.set $shift
  i32.const 7232
  local.get $offset
  i64.const 6
  i64.shr_s
  i32.wrap_i64
  i32.const 3
  i32.shl
  i32.add
  local.set $tblPtr
  local.get $tblPtr
  i64.load
  local.set $b0
  local.get $tblPtr
  i64.load offset=8
  local.set $b1
  local.get $tblPtr
  i64.load offset=16
  local.set $b2
  local.get $shift
  i64.const 0
  i64.ne
  if
   i32.const 64
   i64.extend_i32_s
   local.get $shift
   i64.sub
   local.set $rshift
   local.get $tblPtr
   i64.load offset=24
   local.set $b3
   local.get $b1
   local.get $rshift
   i64.shr_u
   local.get $b0
   local.get $shift
   i64.shl
   i64.or
   local.set $s0
   local.get $b2
   local.get $rshift
   i64.shr_u
   local.get $b1
   local.get $shift
   i64.shl
   i64.or
   local.set $s1
   local.get $b3
   local.get $rshift
   i64.shr_u
   local.get $b2
   local.get $shift
   i64.shl
   i64.or
   local.set $s2
  else
   local.get $b0
   local.set $s0
   local.get $b1
   local.set $s1
   local.get $b2
   local.set $s2
  end
  local.get $u
  i64.const 4503599627370495
  i64.and
  i64.const 4503599627370496
  i64.or
  local.set $significand
  block $~lib/math/umuldi|inlined.0 (result i64)
   local.get $s1
   local.set $u|15
   local.get $significand
   local.set $v
   local.get $u|15
   i64.const 4294967295
   i64.and
   local.set $u1
   local.get $v
   i64.const 4294967295
   i64.and
   local.set $v1
   local.get $u|15
   i64.const 32
   i64.shr_u
   local.set $u|15
   local.get $v
   i64.const 32
   i64.shr_u
   local.set $v
   local.get $u1
   local.get $v1
   i64.mul
   local.set $t
   local.get $t
   i64.const 4294967295
   i64.and
   local.set $w0
   local.get $u|15
   local.get $v1
   i64.mul
   local.get $t
   i64.const 32
   i64.shr_u
   i64.add
   local.set $t
   local.get $t
   i64.const 32
   i64.shr_u
   local.set $w1
   local.get $u1
   local.get $v
   i64.mul
   local.get $t
   i64.const 4294967295
   i64.and
   i64.add
   local.set $t
   local.get $u|15
   local.get $v
   i64.mul
   local.get $w1
   i64.add
   local.get $t
   i64.const 32
   i64.shr_u
   i64.add
   global.set $~lib/math/res128_hi
   local.get $t
   i64.const 32
   i64.shl
   local.get $w0
   i64.add
   br $~lib/math/umuldi|inlined.0
  end
  local.set $blo
  global.get $~lib/math/res128_hi
  local.set $bhi
  local.get $s0
  local.get $significand
  i64.mul
  local.set $ahi
  local.get $s2
  i64.const 32
  i64.shr_u
  local.get $significand
  i64.const 32
  i64.shr_s
  i64.mul
  local.set $clo
  local.get $blo
  local.get $clo
  i64.add
  local.set $plo
  local.get $ahi
  local.get $bhi
  i64.add
  local.get $plo
  local.get $clo
  i64.lt_u
  i64.extend_i32_u
  i64.add
  local.set $phi
  local.get $plo
  i64.const 2
  i64.shl
  local.set $rlo
  local.get $phi
  i64.const 2
  i64.shl
  local.get $plo
  i64.const 62
  i64.shr_u
  i64.or
  local.set $rhi
  local.get $rhi
  i64.const 63
  i64.shr_s
  local.set $slo
  local.get $slo
  i64.const 1
  i64.shr_s
  local.set $shi
  local.get $phi
  i64.const 62
  i64.shr_s
  local.get $slo
  i64.sub
  local.set $q
  i64.const 4372995238176751616
  block $~lib/math/pio2_right|inlined.0 (result i64)
   local.get $rlo
   local.get $slo
   i64.xor
   local.set $q0
   local.get $rhi
   local.get $shi
   i64.xor
   local.set $q1
   local.get $q1
   i64.clz
   local.set $shift|35
   local.get $q1
   local.get $shift|35
   i64.shl
   local.get $q0
   i64.const 64
   local.get $shift|35
   i64.sub
   i64.shr_u
   i64.or
   local.set $q1
   local.get $q0
   local.get $shift|35
   i64.shl
   local.set $q0
   block $~lib/math/umuldi|inlined.1 (result i64)
    i64.const -3958705157555305932
    local.set $u|36
    local.get $q1
    local.set $v|37
    local.get $u|36
    i64.const 4294967295
    i64.and
    local.set $u1|38
    local.get $v|37
    i64.const 4294967295
    i64.and
    local.set $v1|39
    local.get $u|36
    i64.const 32
    i64.shr_u
    local.set $u|36
    local.get $v|37
    i64.const 32
    i64.shr_u
    local.set $v|37
    local.get $u1|38
    local.get $v1|39
    i64.mul
    local.set $t|42
    local.get $t|42
    i64.const 4294967295
    i64.and
    local.set $w0|40
    local.get $u|36
    local.get $v1|39
    i64.mul
    local.get $t|42
    i64.const 32
    i64.shr_u
    i64.add
    local.set $t|42
    local.get $t|42
    i64.const 32
    i64.shr_u
    local.set $w1|41
    local.get $u1|38
    local.get $v|37
    i64.mul
    local.get $t|42
    i64.const 4294967295
    i64.and
    i64.add
    local.set $t|42
    local.get $u|36
    local.get $v|37
    i64.mul
    local.get $w1|41
    i64.add
    local.get $t|42
    i64.const 32
    i64.shr_u
    i64.add
    global.set $~lib/math/res128_hi
    local.get $t|42
    i64.const 32
    i64.shl
    local.get $w0|40
    i64.add
    br $~lib/math/umuldi|inlined.1
   end
   local.set $lo
   global.get $~lib/math/res128_hi
   local.set $hi
   local.get $hi
   i64.const 11
   i64.shr_u
   local.set $ahi|45
   local.get $lo
   i64.const 11
   i64.shr_u
   local.get $hi
   i64.const 53
   i64.shl
   i64.or
   local.set $alo
   f64.const 2.6469779601696886e-23
   i64.const -4267615245585081135
   f64.convert_i64_u
   f64.mul
   local.get $q1
   f64.convert_i64_u
   f64.mul
   f64.const 2.6469779601696886e-23
   i64.const -3958705157555305932
   f64.convert_i64_u
   f64.mul
   local.get $q0
   f64.convert_i64_u
   f64.mul
   f64.add
   i64.trunc_sat_f64_u
   local.set $blo|47
   local.get $ahi|45
   local.get $lo
   local.get $blo|47
   i64.lt_u
   i64.extend_i32_u
   i64.add
   f64.convert_i64_u
   global.set $~lib/math/rempio2_y0
   f64.const 5.421010862427522e-20
   local.get $alo
   local.get $blo|47
   i64.add
   f64.convert_i64_u
   f64.mul
   global.set $~lib/math/rempio2_y1
   local.get $shift|35
   br $~lib/math/pio2_right|inlined.0
  end
  i64.const 52
  i64.shl
  i64.sub
  local.set $shifter
  local.get $u
  local.get $rhi
  i64.xor
  i64.const -9223372036854775808
  i64.and
  local.set $signbit
  local.get $shifter
  local.get $signbit
  i64.or
  f64.reinterpret_i64
  local.set $coeff
  global.get $~lib/math/rempio2_y0
  local.get $coeff
  f64.mul
  global.set $~lib/math/rempio2_y0
  global.get $~lib/math/rempio2_y1
  local.get $coeff
  f64.mul
  global.set $~lib/math/rempio2_y1
  local.get $q
  i32.wrap_i64
  return
 )
 (func $~lib/math/NativeMath.sin (param $x f64) (result f64)
  (local $u i64)
  (local $ux i32)
  (local $sign i32)
  (local $x|4 f64)
  (local $y f64)
  (local $iy i32)
  (local $z f64)
  (local $w f64)
  (local $r f64)
  (local $v f64)
  (local $x|11 f64)
  (local $u|12 i64)
  (local $sign|13 i32)
  (local $ix i32)
  (local $q i32)
  (local $z|16 f64)
  (local $y0 f64)
  (local $y1 f64)
  (local $q|19 f64)
  (local $r|20 f64)
  (local $w|21 f64)
  (local $j i32)
  (local $y0|23 f64)
  (local $hi i32)
  (local $i i32)
  (local $t f64)
  (local $t|27 f64)
  (local $y1|28 f64)
  (local $q|29 i32)
  (local $n i32)
  (local $y0|31 f64)
  (local $y1|32 f64)
  (local $x|33 f64)
  (local $y|34 f64)
  (local $z|35 f64)
  (local $w|36 f64)
  (local $r|37 f64)
  (local $hz f64)
  (local $x|39 f64)
  (local $y|40 f64)
  (local $iy|41 i32)
  (local $z|42 f64)
  (local $w|43 f64)
  (local $r|44 f64)
  (local $v|45 f64)
  local.get $x
  i64.reinterpret_f64
  local.set $u
  local.get $u
  i64.const 32
  i64.shr_u
  i32.wrap_i64
  local.set $ux
  local.get $ux
  i32.const 31
  i32.shr_u
  local.set $sign
  local.get $ux
  i32.const 2147483647
  i32.and
  local.set $ux
  local.get $ux
  i32.const 1072243195
  i32.le_u
  if
   local.get $ux
   i32.const 1045430272
   i32.lt_u
   if
    local.get $x
    return
   end
   block $~lib/math/sin_kern|inlined.0 (result f64)
    local.get $x
    local.set $x|4
    f64.const 0
    local.set $y
    i32.const 0
    local.set $iy
    local.get $x|4
    local.get $x|4
    f64.mul
    local.set $z
    local.get $z
    local.get $z
    f64.mul
    local.set $w
    f64.const 0.00833333333332249
    local.get $z
    f64.const -1.984126982985795e-04
    local.get $z
    f64.const 2.7557313707070068e-06
    f64.mul
    f64.add
    f64.mul
    f64.add
    local.get $z
    local.get $w
    f64.mul
    f64.const -2.5050760253406863e-08
    local.get $z
    f64.const 1.58969099521155e-10
    f64.mul
    f64.add
    f64.mul
    f64.add
    local.set $r
    local.get $z
    local.get $x|4
    f64.mul
    local.set $v
    local.get $iy
    i32.eqz
    if
     local.get $x|4
     local.get $v
     f64.const -0.16666666666666632
     local.get $z
     local.get $r
     f64.mul
     f64.add
     f64.mul
     f64.add
     br $~lib/math/sin_kern|inlined.0
    else
     local.get $x|4
     local.get $z
     f64.const 0.5
     local.get $y
     f64.mul
     local.get $v
     local.get $r
     f64.mul
     f64.sub
     f64.mul
     local.get $y
     f64.sub
     local.get $v
     f64.const -0.16666666666666632
     f64.mul
     f64.sub
     f64.sub
     br $~lib/math/sin_kern|inlined.0
    end
    unreachable
   end
   return
  end
  local.get $ux
  i32.const 2146435072
  i32.ge_u
  if
   local.get $x
   local.get $x
   f64.sub
   return
  end
  block $~lib/math/rempio2|inlined.0 (result i32)
   local.get $x
   local.set $x|11
   local.get $u
   local.set $u|12
   local.get $sign
   local.set $sign|13
   local.get $u|12
   i64.const 32
   i64.shr_u
   i32.wrap_i64
   i32.const 2147483647
   i32.and
   local.set $ix
   i32.const 0
   i32.const 1
   i32.lt_s
   drop
   local.get $ix
   i32.const 1073928572
   i32.lt_u
   if
    i32.const 1
    local.set $q
    local.get $sign|13
    i32.eqz
    if
     local.get $x|11
     f64.const 1.5707963267341256
     f64.sub
     local.set $z|16
     local.get $ix
     i32.const 1073291771
     i32.ne
     if
      local.get $z|16
      f64.const 6.077100506506192e-11
      f64.sub
      local.set $y0
      local.get $z|16
      local.get $y0
      f64.sub
      f64.const 6.077100506506192e-11
      f64.sub
      local.set $y1
     else
      local.get $z|16
      f64.const 6.077100506303966e-11
      f64.sub
      local.set $z|16
      local.get $z|16
      f64.const 2.0222662487959506e-21
      f64.sub
      local.set $y0
      local.get $z|16
      local.get $y0
      f64.sub
      f64.const 2.0222662487959506e-21
      f64.sub
      local.set $y1
     end
    else
     local.get $x|11
     f64.const 1.5707963267341256
     f64.add
     local.set $z|16
     local.get $ix
     i32.const 1073291771
     i32.ne
     if
      local.get $z|16
      f64.const 6.077100506506192e-11
      f64.add
      local.set $y0
      local.get $z|16
      local.get $y0
      f64.sub
      f64.const 6.077100506506192e-11
      f64.add
      local.set $y1
     else
      local.get $z|16
      f64.const 6.077100506303966e-11
      f64.add
      local.set $z|16
      local.get $z|16
      f64.const 2.0222662487959506e-21
      f64.add
      local.set $y0
      local.get $z|16
      local.get $y0
      f64.sub
      f64.const 2.0222662487959506e-21
      f64.add
      local.set $y1
     end
     i32.const -1
     local.set $q
    end
    local.get $y0
    global.set $~lib/math/rempio2_y0
    local.get $y1
    global.set $~lib/math/rempio2_y1
    local.get $q
    br $~lib/math/rempio2|inlined.0
   end
   local.get $ix
   i32.const 1094263291
   i32.lt_u
   if
    local.get $x|11
    f64.const 0.6366197723675814
    f64.mul
    f64.nearest
    local.set $q|19
    local.get $x|11
    local.get $q|19
    f64.const 1.5707963267341256
    f64.mul
    f64.sub
    local.set $r|20
    local.get $q|19
    f64.const 6.077100506506192e-11
    f64.mul
    local.set $w|21
    local.get $ix
    i32.const 20
    i32.shr_u
    local.set $j
    local.get $r|20
    local.get $w|21
    f64.sub
    local.set $y0|23
    local.get $y0|23
    i64.reinterpret_f64
    i64.const 32
    i64.shr_u
    i32.wrap_i64
    local.set $hi
    local.get $j
    local.get $hi
    i32.const 20
    i32.shr_u
    i32.const 2047
    i32.and
    i32.sub
    local.set $i
    local.get $i
    i32.const 16
    i32.gt_u
    if
     local.get $r|20
     local.set $t
     local.get $q|19
     f64.const 6.077100506303966e-11
     f64.mul
     local.set $w|21
     local.get $t
     local.get $w|21
     f64.sub
     local.set $r|20
     local.get $q|19
     f64.const 2.0222662487959506e-21
     f64.mul
     local.get $t
     local.get $r|20
     f64.sub
     local.get $w|21
     f64.sub
     f64.sub
     local.set $w|21
     local.get $r|20
     local.get $w|21
     f64.sub
     local.set $y0|23
     local.get $y0|23
     i64.reinterpret_f64
     i64.const 32
     i64.shr_u
     i32.wrap_i64
     local.set $hi
     local.get $j
     local.get $hi
     i32.const 20
     i32.shr_u
     i32.const 2047
     i32.and
     i32.sub
     local.set $i
     local.get $i
     i32.const 49
     i32.gt_u
     if
      local.get $r|20
      local.set $t|27
      local.get $q|19
      f64.const 2.0222662487111665e-21
      f64.mul
      local.set $w|21
      local.get $t|27
      local.get $w|21
      f64.sub
      local.set $r|20
      local.get $q|19
      f64.const 8.4784276603689e-32
      f64.mul
      local.get $t|27
      local.get $r|20
      f64.sub
      local.get $w|21
      f64.sub
      f64.sub
      local.set $w|21
      local.get $r|20
      local.get $w|21
      f64.sub
      local.set $y0|23
     end
    end
    local.get $r|20
    local.get $y0|23
    f64.sub
    local.get $w|21
    f64.sub
    local.set $y1|28
    local.get $y0|23
    global.set $~lib/math/rempio2_y0
    local.get $y1|28
    global.set $~lib/math/rempio2_y1
    local.get $q|19
    i32.trunc_sat_f64_s
    br $~lib/math/rempio2|inlined.0
   end
   local.get $x|11
   local.get $u|12
   call $~lib/math/pio2_large_quot
   local.set $q|29
   i32.const 0
   local.get $q|29
   i32.sub
   local.get $q|29
   local.get $sign|13
   select
   br $~lib/math/rempio2|inlined.0
  end
  local.set $n
  global.get $~lib/math/rempio2_y0
  local.set $y0|31
  global.get $~lib/math/rempio2_y1
  local.set $y1|32
  local.get $n
  i32.const 1
  i32.and
  if (result f64)
   block $~lib/math/cos_kern|inlined.0 (result f64)
    local.get $y0|31
    local.set $x|33
    local.get $y1|32
    local.set $y|34
    local.get $x|33
    local.get $x|33
    f64.mul
    local.set $z|35
    local.get $z|35
    local.get $z|35
    f64.mul
    local.set $w|36
    local.get $z|35
    f64.const 0.0416666666666666
    local.get $z|35
    f64.const -0.001388888888887411
    local.get $z|35
    f64.const 2.480158728947673e-05
    f64.mul
    f64.add
    f64.mul
    f64.add
    f64.mul
    local.get $w|36
    local.get $w|36
    f64.mul
    f64.const -2.7557314351390663e-07
    local.get $z|35
    f64.const 2.087572321298175e-09
    local.get $z|35
    f64.const -1.1359647557788195e-11
    f64.mul
    f64.add
    f64.mul
    f64.add
    f64.mul
    f64.add
    local.set $r|37
    f64.const 0.5
    local.get $z|35
    f64.mul
    local.set $hz
    f64.const 1
    local.get $hz
    f64.sub
    local.set $w|36
    local.get $w|36
    f64.const 1
    local.get $w|36
    f64.sub
    local.get $hz
    f64.sub
    local.get $z|35
    local.get $r|37
    f64.mul
    local.get $x|33
    local.get $y|34
    f64.mul
    f64.sub
    f64.add
    f64.add
    br $~lib/math/cos_kern|inlined.0
   end
  else
   block $~lib/math/sin_kern|inlined.1 (result f64)
    local.get $y0|31
    local.set $x|39
    local.get $y1|32
    local.set $y|40
    i32.const 1
    local.set $iy|41
    local.get $x|39
    local.get $x|39
    f64.mul
    local.set $z|42
    local.get $z|42
    local.get $z|42
    f64.mul
    local.set $w|43
    f64.const 0.00833333333332249
    local.get $z|42
    f64.const -1.984126982985795e-04
    local.get $z|42
    f64.const 2.7557313707070068e-06
    f64.mul
    f64.add
    f64.mul
    f64.add
    local.get $z|42
    local.get $w|43
    f64.mul
    f64.const -2.5050760253406863e-08
    local.get $z|42
    f64.const 1.58969099521155e-10
    f64.mul
    f64.add
    f64.mul
    f64.add
    local.set $r|44
    local.get $z|42
    local.get $x|39
    f64.mul
    local.set $v|45
    local.get $iy|41
    i32.eqz
    if
     local.get $x|39
     local.get $v|45
     f64.const -0.16666666666666632
     local.get $z|42
     local.get $r|44
     f64.mul
     f64.add
     f64.mul
     f64.add
     br $~lib/math/sin_kern|inlined.1
    else
     local.get $x|39
     local.get $z|42
     f64.const 0.5
     local.get $y|40
     f64.mul
     local.get $v|45
     local.get $r|44
     f64.mul
     f64.sub
     f64.mul
     local.get $y|40
     f64.sub
     local.get $v|45
     f64.const -0.16666666666666632
     f64.mul
     f64.sub
     f64.sub
     br $~lib/math/sin_kern|inlined.1
    end
    unreachable
   end
  end
  local.set $x
  local.get $n
  i32.const 2
  i32.and
  if (result f64)
   local.get $x
   f64.neg
  else
   local.get $x
  end
  return
 )
 (func $~lib/math/NativeMath.cos (param $x f64) (result f64)
  (local $u i64)
  (local $ux i32)
  (local $sign i32)
  (local $x|4 f64)
  (local $y f64)
  (local $z f64)
  (local $w f64)
  (local $r f64)
  (local $hz f64)
  (local $x|10 f64)
  (local $u|11 i64)
  (local $sign|12 i32)
  (local $ix i32)
  (local $q i32)
  (local $z|15 f64)
  (local $y0 f64)
  (local $y1 f64)
  (local $q|18 f64)
  (local $r|19 f64)
  (local $w|20 f64)
  (local $j i32)
  (local $y0|22 f64)
  (local $hi i32)
  (local $i i32)
  (local $t f64)
  (local $t|26 f64)
  (local $y1|27 f64)
  (local $q|28 i32)
  (local $n i32)
  (local $y0|30 f64)
  (local $y1|31 f64)
  (local $x|32 f64)
  (local $y|33 f64)
  (local $iy i32)
  (local $z|35 f64)
  (local $w|36 f64)
  (local $r|37 f64)
  (local $v f64)
  (local $x|39 f64)
  (local $y|40 f64)
  (local $z|41 f64)
  (local $w|42 f64)
  (local $r|43 f64)
  (local $hz|44 f64)
  local.get $x
  i64.reinterpret_f64
  local.set $u
  local.get $u
  i64.const 32
  i64.shr_u
  i32.wrap_i64
  local.set $ux
  local.get $ux
  i32.const 31
  i32.shr_u
  local.set $sign
  local.get $ux
  i32.const 2147483647
  i32.and
  local.set $ux
  local.get $ux
  i32.const 1072243195
  i32.le_u
  if
   local.get $ux
   i32.const 1044816030
   i32.lt_u
   if
    f64.const 1
    return
   end
   block $~lib/math/cos_kern|inlined.1 (result f64)
    local.get $x
    local.set $x|4
    f64.const 0
    local.set $y
    local.get $x|4
    local.get $x|4
    f64.mul
    local.set $z
    local.get $z
    local.get $z
    f64.mul
    local.set $w
    local.get $z
    f64.const 0.0416666666666666
    local.get $z
    f64.const -0.001388888888887411
    local.get $z
    f64.const 2.480158728947673e-05
    f64.mul
    f64.add
    f64.mul
    f64.add
    f64.mul
    local.get $w
    local.get $w
    f64.mul
    f64.const -2.7557314351390663e-07
    local.get $z
    f64.const 2.087572321298175e-09
    local.get $z
    f64.const -1.1359647557788195e-11
    f64.mul
    f64.add
    f64.mul
    f64.add
    f64.mul
    f64.add
    local.set $r
    f64.const 0.5
    local.get $z
    f64.mul
    local.set $hz
    f64.const 1
    local.get $hz
    f64.sub
    local.set $w
    local.get $w
    f64.const 1
    local.get $w
    f64.sub
    local.get $hz
    f64.sub
    local.get $z
    local.get $r
    f64.mul
    local.get $x|4
    local.get $y
    f64.mul
    f64.sub
    f64.add
    f64.add
    br $~lib/math/cos_kern|inlined.1
   end
   return
  end
  local.get $ux
  i32.const 2146435072
  i32.ge_u
  if
   local.get $x
   local.get $x
   f64.sub
   return
  end
  block $~lib/math/rempio2|inlined.1 (result i32)
   local.get $x
   local.set $x|10
   local.get $u
   local.set $u|11
   local.get $sign
   local.set $sign|12
   local.get $u|11
   i64.const 32
   i64.shr_u
   i32.wrap_i64
   i32.const 2147483647
   i32.and
   local.set $ix
   i32.const 0
   i32.const 1
   i32.lt_s
   drop
   local.get $ix
   i32.const 1073928572
   i32.lt_u
   if
    i32.const 1
    local.set $q
    local.get $sign|12
    i32.eqz
    if
     local.get $x|10
     f64.const 1.5707963267341256
     f64.sub
     local.set $z|15
     local.get $ix
     i32.const 1073291771
     i32.ne
     if
      local.get $z|15
      f64.const 6.077100506506192e-11
      f64.sub
      local.set $y0
      local.get $z|15
      local.get $y0
      f64.sub
      f64.const 6.077100506506192e-11
      f64.sub
      local.set $y1
     else
      local.get $z|15
      f64.const 6.077100506303966e-11
      f64.sub
      local.set $z|15
      local.get $z|15
      f64.const 2.0222662487959506e-21
      f64.sub
      local.set $y0
      local.get $z|15
      local.get $y0
      f64.sub
      f64.const 2.0222662487959506e-21
      f64.sub
      local.set $y1
     end
    else
     local.get $x|10
     f64.const 1.5707963267341256
     f64.add
     local.set $z|15
     local.get $ix
     i32.const 1073291771
     i32.ne
     if
      local.get $z|15
      f64.const 6.077100506506192e-11
      f64.add
      local.set $y0
      local.get $z|15
      local.get $y0
      f64.sub
      f64.const 6.077100506506192e-11
      f64.add
      local.set $y1
     else
      local.get $z|15
      f64.const 6.077100506303966e-11
      f64.add
      local.set $z|15
      local.get $z|15
      f64.const 2.0222662487959506e-21
      f64.add
      local.set $y0
      local.get $z|15
      local.get $y0
      f64.sub
      f64.const 2.0222662487959506e-21
      f64.add
      local.set $y1
     end
     i32.const -1
     local.set $q
    end
    local.get $y0
    global.set $~lib/math/rempio2_y0
    local.get $y1
    global.set $~lib/math/rempio2_y1
    local.get $q
    br $~lib/math/rempio2|inlined.1
   end
   local.get $ix
   i32.const 1094263291
   i32.lt_u
   if
    local.get $x|10
    f64.const 0.6366197723675814
    f64.mul
    f64.nearest
    local.set $q|18
    local.get $x|10
    local.get $q|18
    f64.const 1.5707963267341256
    f64.mul
    f64.sub
    local.set $r|19
    local.get $q|18
    f64.const 6.077100506506192e-11
    f64.mul
    local.set $w|20
    local.get $ix
    i32.const 20
    i32.shr_u
    local.set $j
    local.get $r|19
    local.get $w|20
    f64.sub
    local.set $y0|22
    local.get $y0|22
    i64.reinterpret_f64
    i64.const 32
    i64.shr_u
    i32.wrap_i64
    local.set $hi
    local.get $j
    local.get $hi
    i32.const 20
    i32.shr_u
    i32.const 2047
    i32.and
    i32.sub
    local.set $i
    local.get $i
    i32.const 16
    i32.gt_u
    if
     local.get $r|19
     local.set $t
     local.get $q|18
     f64.const 6.077100506303966e-11
     f64.mul
     local.set $w|20
     local.get $t
     local.get $w|20
     f64.sub
     local.set $r|19
     local.get $q|18
     f64.const 2.0222662487959506e-21
     f64.mul
     local.get $t
     local.get $r|19
     f64.sub
     local.get $w|20
     f64.sub
     f64.sub
     local.set $w|20
     local.get $r|19
     local.get $w|20
     f64.sub
     local.set $y0|22
     local.get $y0|22
     i64.reinterpret_f64
     i64.const 32
     i64.shr_u
     i32.wrap_i64
     local.set $hi
     local.get $j
     local.get $hi
     i32.const 20
     i32.shr_u
     i32.const 2047
     i32.and
     i32.sub
     local.set $i
     local.get $i
     i32.const 49
     i32.gt_u
     if
      local.get $r|19
      local.set $t|26
      local.get $q|18
      f64.const 2.0222662487111665e-21
      f64.mul
      local.set $w|20
      local.get $t|26
      local.get $w|20
      f64.sub
      local.set $r|19
      local.get $q|18
      f64.const 8.4784276603689e-32
      f64.mul
      local.get $t|26
      local.get $r|19
      f64.sub
      local.get $w|20
      f64.sub
      f64.sub
      local.set $w|20
      local.get $r|19
      local.get $w|20
      f64.sub
      local.set $y0|22
     end
    end
    local.get $r|19
    local.get $y0|22
    f64.sub
    local.get $w|20
    f64.sub
    local.set $y1|27
    local.get $y0|22
    global.set $~lib/math/rempio2_y0
    local.get $y1|27
    global.set $~lib/math/rempio2_y1
    local.get $q|18
    i32.trunc_sat_f64_s
    br $~lib/math/rempio2|inlined.1
   end
   local.get $x|10
   local.get $u|11
   call $~lib/math/pio2_large_quot
   local.set $q|28
   i32.const 0
   local.get $q|28
   i32.sub
   local.get $q|28
   local.get $sign|12
   select
   br $~lib/math/rempio2|inlined.1
  end
  local.set $n
  global.get $~lib/math/rempio2_y0
  local.set $y0|30
  global.get $~lib/math/rempio2_y1
  local.set $y1|31
  local.get $n
  i32.const 1
  i32.and
  if (result f64)
   block $~lib/math/sin_kern|inlined.2 (result f64)
    local.get $y0|30
    local.set $x|32
    local.get $y1|31
    local.set $y|33
    i32.const 1
    local.set $iy
    local.get $x|32
    local.get $x|32
    f64.mul
    local.set $z|35
    local.get $z|35
    local.get $z|35
    f64.mul
    local.set $w|36
    f64.const 0.00833333333332249
    local.get $z|35
    f64.const -1.984126982985795e-04
    local.get $z|35
    f64.const 2.7557313707070068e-06
    f64.mul
    f64.add
    f64.mul
    f64.add
    local.get $z|35
    local.get $w|36
    f64.mul
    f64.const -2.5050760253406863e-08
    local.get $z|35
    f64.const 1.58969099521155e-10
    f64.mul
    f64.add
    f64.mul
    f64.add
    local.set $r|37
    local.get $z|35
    local.get $x|32
    f64.mul
    local.set $v
    local.get $iy
    i32.eqz
    if
     local.get $x|32
     local.get $v
     f64.const -0.16666666666666632
     local.get $z|35
     local.get $r|37
     f64.mul
     f64.add
     f64.mul
     f64.add
     br $~lib/math/sin_kern|inlined.2
    else
     local.get $x|32
     local.get $z|35
     f64.const 0.5
     local.get $y|33
     f64.mul
     local.get $v
     local.get $r|37
     f64.mul
     f64.sub
     f64.mul
     local.get $y|33
     f64.sub
     local.get $v
     f64.const -0.16666666666666632
     f64.mul
     f64.sub
     f64.sub
     br $~lib/math/sin_kern|inlined.2
    end
    unreachable
   end
  else
   block $~lib/math/cos_kern|inlined.2 (result f64)
    local.get $y0|30
    local.set $x|39
    local.get $y1|31
    local.set $y|40
    local.get $x|39
    local.get $x|39
    f64.mul
    local.set $z|41
    local.get $z|41
    local.get $z|41
    f64.mul
    local.set $w|42
    local.get $z|41
    f64.const 0.0416666666666666
    local.get $z|41
    f64.const -0.001388888888887411
    local.get $z|41
    f64.const 2.480158728947673e-05
    f64.mul
    f64.add
    f64.mul
    f64.add
    f64.mul
    local.get $w|42
    local.get $w|42
    f64.mul
    f64.const -2.7557314351390663e-07
    local.get $z|41
    f64.const 2.087572321298175e-09
    local.get $z|41
    f64.const -1.1359647557788195e-11
    f64.mul
    f64.add
    f64.mul
    f64.add
    f64.mul
    f64.add
    local.set $r|43
    f64.const 0.5
    local.get $z|41
    f64.mul
    local.set $hz|44
    f64.const 1
    local.get $hz|44
    f64.sub
    local.set $w|42
    local.get $w|42
    f64.const 1
    local.get $w|42
    f64.sub
    local.get $hz|44
    f64.sub
    local.get $z|41
    local.get $r|43
    f64.mul
    local.get $x|39
    local.get $y|40
    f64.mul
    f64.sub
    f64.add
    f64.add
    br $~lib/math/cos_kern|inlined.2
   end
  end
  local.set $x
  local.get $n
  i32.const 1
  i32.add
  i32.const 2
  i32.and
  if (result f64)
   local.get $x
   f64.neg
  else
   local.get $x
  end
  return
 )
 (func $assembly/filters/wave (param $srcPtr i32) (param $dstPtr i32) (param $w i32) (param $h i32) (param $amp f32) (param $freq f32) (param $startY i32) (param $endY i32)
  (local $k f32)
  (local $y i32)
  (local $row i32)
  (local $x i32)
  (local $sx f32)
  (local $sy f32)
  (local $ptr i32)
  (local $w|15 i32)
  (local $h|16 i32)
  (local $x|17 f32)
  (local $y|18 f32)
  (local $val f32)
  (local $val|20 f32)
  (local $x|21 f64)
  (local $x0 i32)
  (local $x|23 f64)
  (local $y0 i32)
  (local $x1 i32)
  (local $y1 i32)
  (local $tx f32)
  (local $ty f32)
  (local $i00 i32)
  (local $i10 i32)
  (local $i01 i32)
  (local $i11 i32)
  (local $a f32)
  (local $b f32)
  (local $t f32)
  (local $a|36 f32)
  (local $b|37 f32)
  (local $t|38 f32)
  (local $a|39 f32)
  (local $b|40 f32)
  (local $t|41 f32)
  (local $r f32)
  (local $a|43 f32)
  (local $b|44 f32)
  (local $t|45 f32)
  (local $a|46 f32)
  (local $b|47 f32)
  (local $t|48 f32)
  (local $a|49 f32)
  (local $b|50 f32)
  (local $t|51 f32)
  (local $g f32)
  (local $a|53 f32)
  (local $b|54 f32)
  (local $t|55 f32)
  (local $a|56 f32)
  (local $b|57 f32)
  (local $t|58 f32)
  (local $a|59 f32)
  (local $b|60 f32)
  (local $t|61 f32)
  (local $b|62 f32)
  (local $a|63 f32)
  (local $b|64 f32)
  (local $t|65 f32)
  (local $a|66 f32)
  (local $b|67 f32)
  (local $t|68 f32)
  (local $a|69 f32)
  (local $b|70 f32)
  (local $t|71 f32)
  (local $a|72 f32)
  (local $val|73 f32)
  (local $val|74 f32)
  (local $val|75 f32)
  (local $val|76 f32)
  (local $val|77 f32)
  (local $val|78 f32)
  (local $val|79 f32)
  (local $val|80 f32)
  f64.const 2
  global.get $~lib/math/NativeMath.PI
  f64.mul
  local.get $freq
  f64.promote_f32
  f64.div
  f32.demote_f64
  local.set $k
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $w
     i32.lt_s
     if
      local.get $x
      f32.convert_i32_s
      local.get $amp
      local.get $y
      f64.convert_i32_s
      local.get $k
      f64.promote_f32
      f64.mul
      call $~lib/math/NativeMath.sin
      f32.demote_f64
      f32.mul
      f32.add
      local.set $sx
      local.get $y
      f32.convert_i32_s
      local.get $amp
      local.get $x
      f64.convert_i32_s
      local.get $k
      f64.promote_f32
      f64.mul
      call $~lib/math/NativeMath.cos
      f32.demote_f64
      f32.mul
      f32.add
      local.set $sy
      local.get $dstPtr
      local.get $row
      i32.add
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      block $assembly/math/sampleBilinear|inlined.0 (result i32)
       local.get $srcPtr
       local.set $ptr
       local.get $w
       local.set $w|15
       local.get $h
       local.set $h|16
       local.get $sx
       local.set $x|17
       local.get $sy
       local.set $y|18
       block $assembly/math/isNaN|inlined.12 (result i32)
        local.get $x|17
        local.set $val
        local.get $val
        local.get $val
        f32.ne
        br $assembly/math/isNaN|inlined.12
       end
       if (result i32)
        i32.const 1
       else
        block $assembly/math/isNaN|inlined.13 (result i32)
         local.get $y|18
         local.set $val|20
         local.get $val|20
         local.get $val|20
         f32.ne
         br $assembly/math/isNaN|inlined.13
        end
       end
       if
        i32.const 0
        br $assembly/math/sampleBilinear|inlined.0
       end
       local.get $x|17
       f32.const 0
       f32.lt
       if
        f32.const 0
        local.set $x|17
       end
       local.get $y|18
       f32.const 0
       f32.lt
       if
        f32.const 0
        local.set $y|18
       end
       local.get $x|17
       local.get $w|15
       f32.convert_i32_s
       f32.const 1
       f32.sub
       f32.ge
       if
        local.get $w|15
        f64.convert_i32_s
        f64.const 1.000001
        f64.sub
        f32.demote_f64
        local.set $x|17
       end
       local.get $y|18
       local.get $h|16
       f32.convert_i32_s
       f32.const 1
       f32.sub
       f32.ge
       if
        local.get $h|16
        f64.convert_i32_s
        f64.const 1.000001
        f64.sub
        f32.demote_f64
        local.set $y|18
       end
       block $~lib/math/NativeMath.floor|inlined.1 (result f64)
        local.get $x|17
        f64.promote_f32
        local.set $x|21
        local.get $x|21
        f64.floor
        br $~lib/math/NativeMath.floor|inlined.1
       end
       i32.trunc_sat_f64_s
       local.set $x0
       block $~lib/math/NativeMath.floor|inlined.2 (result f64)
        local.get $y|18
        f64.promote_f32
        local.set $x|23
        local.get $x|23
        f64.floor
        br $~lib/math/NativeMath.floor|inlined.2
       end
       i32.trunc_sat_f64_s
       local.set $y0
       local.get $x0
       i32.const 1
       i32.add
       local.set $x1
       local.get $y0
       i32.const 1
       i32.add
       local.set $y1
       local.get $x|17
       local.get $x0
       f32.convert_i32_s
       f32.sub
       local.set $tx
       local.get $y|18
       local.get $y0
       f32.convert_i32_s
       f32.sub
       local.set $ty
       local.get $y0
       local.get $w|15
       i32.mul
       local.get $x0
       i32.add
       i32.const 2
       i32.shl
       local.set $i00
       local.get $y0
       local.get $w|15
       i32.mul
       local.get $x1
       i32.add
       i32.const 2
       i32.shl
       local.set $i10
       local.get $y1
       local.get $w|15
       i32.mul
       local.get $x0
       i32.add
       i32.const 2
       i32.shl
       local.set $i01
       local.get $y1
       local.get $w|15
       i32.mul
       local.get $x1
       i32.add
       i32.const 2
       i32.shl
       local.set $i11
       block $assembly/math/lerp|inlined.2 (result f32)
        block $assembly/math/lerp|inlined.0 (result f32)
         local.get $ptr
         local.get $i00
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a
         local.get $ptr
         local.get $i10
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b
         local.get $tx
         local.set $t
         local.get $a
         local.get $b
         local.get $a
         f32.sub
         local.get $t
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.0
        end
        local.set $a|39
        block $assembly/math/lerp|inlined.1 (result f32)
         local.get $ptr
         local.get $i01
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|36
         local.get $ptr
         local.get $i11
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b|37
         local.get $tx
         local.set $t|38
         local.get $a|36
         local.get $b|37
         local.get $a|36
         f32.sub
         local.get $t|38
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.1
        end
        local.set $b|40
        local.get $ty
        local.set $t|41
        local.get $a|39
        local.get $b|40
        local.get $a|39
        f32.sub
        local.get $t|41
        f32.mul
        f32.add
        br $assembly/math/lerp|inlined.2
       end
       local.set $r
       block $assembly/math/lerp|inlined.5 (result f32)
        block $assembly/math/lerp|inlined.3 (result f32)
         local.get $ptr
         local.get $i00
         i32.add
         i32.const 1
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|43
         local.get $ptr
         local.get $i10
         i32.add
         i32.const 1
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b|44
         local.get $tx
         local.set $t|45
         local.get $a|43
         local.get $b|44
         local.get $a|43
         f32.sub
         local.get $t|45
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.3
        end
        local.set $a|49
        block $assembly/math/lerp|inlined.4 (result f32)
         local.get $ptr
         local.get $i01
         i32.add
         i32.const 1
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|46
         local.get $ptr
         local.get $i11
         i32.add
         i32.const 1
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b|47
         local.get $tx
         local.set $t|48
         local.get $a|46
         local.get $b|47
         local.get $a|46
         f32.sub
         local.get $t|48
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.4
        end
        local.set $b|50
        local.get $ty
        local.set $t|51
        local.get $a|49
        local.get $b|50
        local.get $a|49
        f32.sub
        local.get $t|51
        f32.mul
        f32.add
        br $assembly/math/lerp|inlined.5
       end
       local.set $g
       block $assembly/math/lerp|inlined.8 (result f32)
        block $assembly/math/lerp|inlined.6 (result f32)
         local.get $ptr
         local.get $i00
         i32.add
         i32.const 2
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|53
         local.get $ptr
         local.get $i10
         i32.add
         i32.const 2
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b|54
         local.get $tx
         local.set $t|55
         local.get $a|53
         local.get $b|54
         local.get $a|53
         f32.sub
         local.get $t|55
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.6
        end
        local.set $a|59
        block $assembly/math/lerp|inlined.7 (result f32)
         local.get $ptr
         local.get $i01
         i32.add
         i32.const 2
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|56
         local.get $ptr
         local.get $i11
         i32.add
         i32.const 2
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b|57
         local.get $tx
         local.set $t|58
         local.get $a|56
         local.get $b|57
         local.get $a|56
         f32.sub
         local.get $t|58
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.7
        end
        local.set $b|60
        local.get $ty
        local.set $t|61
        local.get $a|59
        local.get $b|60
        local.get $a|59
        f32.sub
        local.get $t|61
        f32.mul
        f32.add
        br $assembly/math/lerp|inlined.8
       end
       local.set $b|62
       block $assembly/math/lerp|inlined.11 (result f32)
        block $assembly/math/lerp|inlined.9 (result f32)
         local.get $ptr
         local.get $i00
         i32.add
         i32.const 3
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|63
         local.get $ptr
         local.get $i10
         i32.add
         i32.const 3
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b|64
         local.get $tx
         local.set $t|65
         local.get $a|63
         local.get $b|64
         local.get $a|63
         f32.sub
         local.get $t|65
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.9
        end
        local.set $a|69
        block $assembly/math/lerp|inlined.10 (result f32)
         local.get $ptr
         local.get $i01
         i32.add
         i32.const 3
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|66
         local.get $ptr
         local.get $i11
         i32.add
         i32.const 3
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b|67
         local.get $tx
         local.set $t|68
         local.get $a|66
         local.get $b|67
         local.get $a|66
         f32.sub
         local.get $t|68
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.10
        end
        local.set $b|70
        local.get $ty
        local.set $t|71
        local.get $a|69
        local.get $b|70
        local.get $a|69
        f32.sub
        local.get $t|71
        f32.mul
        f32.add
        br $assembly/math/lerp|inlined.11
       end
       local.set $a|72
       block $assembly/math/clamp255|inlined.9 (result i32)
        local.get $r
        local.set $val|73
        block $assembly/math/isNaN|inlined.14 (result i32)
         local.get $val|73
         local.set $val|74
         local.get $val|74
         local.get $val|74
         f32.ne
         br $assembly/math/isNaN|inlined.14
        end
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.9
        end
        local.get $val|73
        f32.const 0
        f32.lt
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.9
        end
        local.get $val|73
        f32.const 255
        f32.gt
        if
         i32.const 255
         br $assembly/math/clamp255|inlined.9
        end
        local.get $val|73
        i32.trunc_sat_f32_u
        br $assembly/math/clamp255|inlined.9
       end
       i32.const 255
       i32.and
       block $assembly/math/clamp255|inlined.10 (result i32)
        local.get $g
        local.set $val|75
        block $assembly/math/isNaN|inlined.15 (result i32)
         local.get $val|75
         local.set $val|76
         local.get $val|76
         local.get $val|76
         f32.ne
         br $assembly/math/isNaN|inlined.15
        end
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.10
        end
        local.get $val|75
        f32.const 0
        f32.lt
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.10
        end
        local.get $val|75
        f32.const 255
        f32.gt
        if
         i32.const 255
         br $assembly/math/clamp255|inlined.10
        end
        local.get $val|75
        i32.trunc_sat_f32_u
        br $assembly/math/clamp255|inlined.10
       end
       i32.const 255
       i32.and
       i32.const 8
       i32.shl
       i32.or
       block $assembly/math/clamp255|inlined.11 (result i32)
        local.get $b|62
        local.set $val|77
        block $assembly/math/isNaN|inlined.16 (result i32)
         local.get $val|77
         local.set $val|78
         local.get $val|78
         local.get $val|78
         f32.ne
         br $assembly/math/isNaN|inlined.16
        end
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.11
        end
        local.get $val|77
        f32.const 0
        f32.lt
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.11
        end
        local.get $val|77
        f32.const 255
        f32.gt
        if
         i32.const 255
         br $assembly/math/clamp255|inlined.11
        end
        local.get $val|77
        i32.trunc_sat_f32_u
        br $assembly/math/clamp255|inlined.11
       end
       i32.const 255
       i32.and
       i32.const 16
       i32.shl
       i32.or
       block $assembly/math/clamp255|inlined.12 (result i32)
        local.get $a|72
        local.set $val|79
        block $assembly/math/isNaN|inlined.17 (result i32)
         local.get $val|79
         local.set $val|80
         local.get $val|80
         local.get $val|80
         f32.ne
         br $assembly/math/isNaN|inlined.17
        end
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.12
        end
        local.get $val|79
        f32.const 0
        f32.lt
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.12
        end
        local.get $val|79
        f32.const 255
        f32.gt
        if
         i32.const 255
         br $assembly/math/clamp255|inlined.12
        end
        local.get $val|79
        i32.trunc_sat_f32_u
        br $assembly/math/clamp255|inlined.12
       end
       i32.const 255
       i32.and
       i32.const 24
       i32.shl
       i32.or
       br $assembly/math/sampleBilinear|inlined.0
      end
      i32.store
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $~lib/math/NativeMath.atan (param $x f64) (result f64)
  (local $ix i32)
  (local $sx f64)
  (local $z f64)
  (local $id i32)
  (local $w f64)
  (local $s1 f64)
  (local $s2 f64)
  (local $s3 f64)
  (local $9 i32)
  local.get $x
  i64.reinterpret_f64
  i64.const 32
  i64.shr_u
  i32.wrap_i64
  local.set $ix
  local.get $x
  local.set $sx
  local.get $ix
  i32.const 2147483647
  i32.and
  local.set $ix
  local.get $ix
  i32.const 1141899264
  i32.ge_u
  if
   local.get $x
   local.get $x
   f64.ne
   if
    local.get $x
    return
   end
   f64.const 1.5707963267948966
   f32.const 7.52316384526264e-37
   f64.promote_f32
   f64.add
   local.set $z
   local.get $z
   local.get $sx
   f64.copysign
   return
  end
  local.get $ix
  i32.const 1071382528
  i32.lt_u
  if
   local.get $ix
   i32.const 1044381696
   i32.lt_u
   if
    local.get $x
    return
   end
   i32.const -1
   local.set $id
  else
   local.get $x
   f64.abs
   local.set $x
   local.get $ix
   i32.const 1072889856
   i32.lt_u
   if
    local.get $ix
    i32.const 1072037888
    i32.lt_u
    if
     i32.const 0
     local.set $id
     f64.const 2
     local.get $x
     f64.mul
     f64.const 1
     f64.sub
     f64.const 2
     local.get $x
     f64.add
     f64.div
     local.set $x
    else
     i32.const 1
     local.set $id
     local.get $x
     f64.const 1
     f64.sub
     local.get $x
     f64.const 1
     f64.add
     f64.div
     local.set $x
    end
   else
    local.get $ix
    i32.const 1073971200
    i32.lt_u
    if
     i32.const 2
     local.set $id
     local.get $x
     f64.const 1.5
     f64.sub
     f64.const 1
     f64.const 1.5
     local.get $x
     f64.mul
     f64.add
     f64.div
     local.set $x
    else
     i32.const 3
     local.set $id
     f64.const -1
     local.get $x
     f64.div
     local.set $x
    end
   end
  end
  local.get $x
  local.get $x
  f64.mul
  local.set $z
  local.get $z
  local.get $z
  f64.mul
  local.set $w
  local.get $z
  f64.const 0.3333333333333293
  local.get $w
  f64.const 0.14285714272503466
  local.get $w
  f64.const 0.09090887133436507
  local.get $w
  f64.const 0.06661073137387531
  local.get $w
  f64.const 0.049768779946159324
  local.get $w
  f64.const 0.016285820115365782
  f64.mul
  f64.add
  f64.mul
  f64.add
  f64.mul
  f64.add
  f64.mul
  f64.add
  f64.mul
  f64.add
  f64.mul
  local.set $s1
  local.get $w
  f64.const -0.19999999999876483
  local.get $w
  f64.const -0.11111110405462356
  local.get $w
  f64.const -0.0769187620504483
  local.get $w
  f64.const -0.058335701337905735
  local.get $w
  f64.const -0.036531572744216916
  f64.mul
  f64.add
  f64.mul
  f64.add
  f64.mul
  f64.add
  f64.mul
  f64.add
  f64.mul
  local.set $s2
  local.get $x
  local.get $s1
  local.get $s2
  f64.add
  f64.mul
  local.set $s3
  local.get $id
  i32.const 0
  i32.lt_s
  if
   local.get $x
   local.get $s3
   f64.sub
   return
  end
  block $break|0
   block $case4|0
    block $case3|0
     block $case2|0
      block $case1|0
       block $case0|0
        local.get $id
        local.set $9
        local.get $9
        i32.const 0
        i32.eq
        br_if $case0|0
        local.get $9
        i32.const 1
        i32.eq
        br_if $case1|0
        local.get $9
        i32.const 2
        i32.eq
        br_if $case2|0
        local.get $9
        i32.const 3
        i32.eq
        br_if $case3|0
        br $case4|0
       end
       f64.const 0.4636476090008061
       local.get $s3
       f64.const 2.2698777452961687e-17
       f64.sub
       local.get $x
       f64.sub
       f64.sub
       local.set $z
       br $break|0
      end
      f64.const 0.7853981633974483
      local.get $s3
      f64.const 3.061616997868383e-17
      f64.sub
      local.get $x
      f64.sub
      f64.sub
      local.set $z
      br $break|0
     end
     f64.const 0.982793723247329
     local.get $s3
     f64.const 1.3903311031230998e-17
     f64.sub
     local.get $x
     f64.sub
     f64.sub
     local.set $z
     br $break|0
    end
    f64.const 1.5707963267948966
    local.get $s3
    f64.const 6.123233995736766e-17
    f64.sub
    local.get $x
    f64.sub
    f64.sub
    local.set $z
    br $break|0
   end
   unreachable
  end
  local.get $z
  local.get $sx
  f64.copysign
  return
 )
 (func $~lib/math/NativeMath.atan2 (param $y f64) (param $x f64) (result f64)
  (local $u i64)
  (local $ix i32)
  (local $lx i32)
  (local $iy i32)
  (local $ly i32)
  (local $m i32)
  (local $8 i32)
  (local $t f64)
  (local $t|10 f64)
  (local $z f64)
  (local $12 i32)
  local.get $x
  local.get $x
  f64.ne
  if (result i32)
   i32.const 1
  else
   local.get $y
   local.get $y
   f64.ne
  end
  if
   local.get $x
   local.get $y
   f64.add
   return
  end
  local.get $x
  i64.reinterpret_f64
  local.set $u
  local.get $u
  i64.const 32
  i64.shr_u
  i32.wrap_i64
  local.set $ix
  local.get $u
  i32.wrap_i64
  local.set $lx
  local.get $y
  i64.reinterpret_f64
  local.set $u
  local.get $u
  i64.const 32
  i64.shr_u
  i32.wrap_i64
  local.set $iy
  local.get $u
  i32.wrap_i64
  local.set $ly
  local.get $ix
  i32.const 1072693248
  i32.sub
  local.get $lx
  i32.or
  i32.const 0
  i32.eq
  if
   local.get $y
   call $~lib/math/NativeMath.atan
   return
  end
  local.get $iy
  i32.const 31
  i32.shr_u
  i32.const 1
  i32.and
  local.get $ix
  i32.const 30
  i32.shr_u
  i32.const 2
  i32.and
  i32.or
  local.set $m
  local.get $ix
  i32.const 2147483647
  i32.and
  local.set $ix
  local.get $iy
  i32.const 2147483647
  i32.and
  local.set $iy
  local.get $iy
  local.get $ly
  i32.or
  i32.const 0
  i32.eq
  if
   block $break|0
    block $case3|0
     block $case2|0
      block $case1|0
       block $case0|0
        local.get $m
        local.set $8
        local.get $8
        i32.const 0
        i32.eq
        br_if $case0|0
        local.get $8
        i32.const 1
        i32.eq
        br_if $case1|0
        local.get $8
        i32.const 2
        i32.eq
        br_if $case2|0
        local.get $8
        i32.const 3
        i32.eq
        br_if $case3|0
        br $break|0
       end
      end
      local.get $y
      return
     end
     global.get $~lib/math/NativeMath.PI
     return
    end
    global.get $~lib/math/NativeMath.PI
    f64.neg
    return
   end
  end
  local.get $ix
  local.get $lx
  i32.or
  i32.const 0
  i32.eq
  if
   local.get $m
   i32.const 1
   i32.and
   if (result f64)
    global.get $~lib/math/NativeMath.PI
    f64.neg
    f64.const 2
    f64.div
   else
    global.get $~lib/math/NativeMath.PI
    f64.const 2
    f64.div
   end
   return
  end
  local.get $ix
  i32.const 2146435072
  i32.eq
  if
   local.get $iy
   i32.const 2146435072
   i32.eq
   if
    local.get $m
    i32.const 2
    i32.and
    if (result f64)
     i32.const 3
     f64.convert_i32_s
     global.get $~lib/math/NativeMath.PI
     f64.mul
     f64.const 4
     f64.div
    else
     global.get $~lib/math/NativeMath.PI
     f64.const 4
     f64.div
    end
    local.set $t
    local.get $m
    i32.const 1
    i32.and
    if (result f64)
     local.get $t
     f64.neg
    else
     local.get $t
    end
    return
   else
    local.get $m
    i32.const 2
    i32.and
    if (result f64)
     global.get $~lib/math/NativeMath.PI
    else
     f64.const 0
    end
    local.set $t|10
    local.get $m
    i32.const 1
    i32.and
    if (result f64)
     local.get $t|10
     f64.neg
    else
     local.get $t|10
    end
    return
   end
   unreachable
  end
  local.get $ix
  i32.const 64
  i32.const 20
  i32.shl
  i32.add
  local.get $iy
  i32.lt_u
  if (result i32)
   i32.const 1
  else
   local.get $iy
   i32.const 2146435072
   i32.eq
  end
  if
   local.get $m
   i32.const 1
   i32.and
   if (result f64)
    global.get $~lib/math/NativeMath.PI
    f64.neg
    f64.const 2
    f64.div
   else
    global.get $~lib/math/NativeMath.PI
    f64.const 2
    f64.div
   end
   return
  end
  local.get $m
  i32.const 2
  i32.and
  if (result i32)
   local.get $iy
   i32.const 64
   i32.const 20
   i32.shl
   i32.add
   local.get $ix
   i32.lt_u
  else
   i32.const 0
  end
  if
   f64.const 0
   local.set $z
  else
   local.get $y
   local.get $x
   f64.div
   f64.abs
   call $~lib/math/NativeMath.atan
   local.set $z
  end
  block $break|1
   block $case3|1
    block $case2|1
     block $case1|1
      block $case0|1
       local.get $m
       local.set $12
       local.get $12
       i32.const 0
       i32.eq
       br_if $case0|1
       local.get $12
       i32.const 1
       i32.eq
       br_if $case1|1
       local.get $12
       i32.const 2
       i32.eq
       br_if $case2|1
       local.get $12
       i32.const 3
       i32.eq
       br_if $case3|1
       br $break|1
      end
      local.get $z
      return
     end
     local.get $z
     f64.neg
     return
    end
    global.get $~lib/math/NativeMath.PI
    local.get $z
    f64.const 1.2246467991473532e-16
    f64.sub
    f64.sub
    return
   end
   local.get $z
   f64.const 1.2246467991473532e-16
   f64.sub
   global.get $~lib/math/NativeMath.PI
   f64.sub
   return
  end
  unreachable
 )
 (func $assembly/filters/twist (param $srcPtr i32) (param $dstPtr i32) (param $w i32) (param $h i32) (param $angle f32) (param $startY i32) (param $endY i32)
  (local $cx f32)
  (local $cy f32)
  (local $x f64)
  (local $maxR f32)
  (local $y i32)
  (local $row i32)
  (local $dy f32)
  (local $x|14 i32)
  (local $dx f32)
  (local $x|16 f64)
  (local $r f32)
  (local $a f32)
  (local $ptr i32)
  (local $w|20 i32)
  (local $h|21 i32)
  (local $x|22 f32)
  (local $y|23 f32)
  (local $val f32)
  (local $val|25 f32)
  (local $x|26 f64)
  (local $x0 i32)
  (local $x|28 f64)
  (local $y0 i32)
  (local $x1 i32)
  (local $y1 i32)
  (local $tx f32)
  (local $ty f32)
  (local $i00 i32)
  (local $i10 i32)
  (local $i01 i32)
  (local $i11 i32)
  (local $a|38 f32)
  (local $b f32)
  (local $t f32)
  (local $a|41 f32)
  (local $b|42 f32)
  (local $t|43 f32)
  (local $a|44 f32)
  (local $b|45 f32)
  (local $t|46 f32)
  (local $r|47 f32)
  (local $a|48 f32)
  (local $b|49 f32)
  (local $t|50 f32)
  (local $a|51 f32)
  (local $b|52 f32)
  (local $t|53 f32)
  (local $a|54 f32)
  (local $b|55 f32)
  (local $t|56 f32)
  (local $g f32)
  (local $a|58 f32)
  (local $b|59 f32)
  (local $t|60 f32)
  (local $a|61 f32)
  (local $b|62 f32)
  (local $t|63 f32)
  (local $a|64 f32)
  (local $b|65 f32)
  (local $t|66 f32)
  (local $b|67 f32)
  (local $a|68 f32)
  (local $b|69 f32)
  (local $t|70 f32)
  (local $a|71 f32)
  (local $b|72 f32)
  (local $t|73 f32)
  (local $a|74 f32)
  (local $b|75 f32)
  (local $t|76 f32)
  (local $a|77 f32)
  (local $val|78 f32)
  (local $val|79 f32)
  (local $val|80 f32)
  (local $val|81 f32)
  (local $val|82 f32)
  (local $val|83 f32)
  (local $val|84 f32)
  (local $val|85 f32)
  local.get $w
  f32.convert_i32_s
  f32.const 2
  f32.div
  local.set $cx
  local.get $h
  f32.convert_i32_s
  f32.const 2
  f32.div
  local.set $cy
  block $~lib/math/NativeMath.sqrt|inlined.1 (result f64)
   local.get $cx
   local.get $cx
   f32.mul
   local.get $cy
   local.get $cy
   f32.mul
   f32.add
   f64.promote_f32
   local.set $x
   local.get $x
   f64.sqrt
   br $~lib/math/NativeMath.sqrt|inlined.1
  end
  f32.demote_f64
  local.set $maxR
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    local.get $y
    f32.convert_i32_s
    local.get $cy
    f32.sub
    local.set $dy
    i32.const 0
    local.set $x|14
    loop $for-loop|1
     local.get $x|14
     local.get $w
     i32.lt_s
     if
      local.get $x|14
      f32.convert_i32_s
      local.get $cx
      f32.sub
      local.set $dx
      block $~lib/math/NativeMath.sqrt|inlined.2 (result f64)
       local.get $dx
       local.get $dx
       f32.mul
       local.get $dy
       local.get $dy
       f32.mul
       f32.add
       f64.promote_f32
       local.set $x|16
       local.get $x|16
       f64.sqrt
       br $~lib/math/NativeMath.sqrt|inlined.2
      end
      f32.demote_f64
      local.set $r
      local.get $dy
      f64.promote_f32
      local.get $dx
      f64.promote_f32
      call $~lib/math/NativeMath.atan2
      f32.demote_f64
      local.get $angle
      f32.const 1
      local.get $r
      local.get $maxR
      f32.div
      f32.sub
      f32.mul
      f32.add
      local.set $a
      local.get $dstPtr
      local.get $row
      i32.add
      local.get $x|14
      i32.const 2
      i32.shl
      i32.add
      block $assembly/math/sampleBilinear|inlined.1 (result i32)
       local.get $srcPtr
       local.set $ptr
       local.get $w
       local.set $w|20
       local.get $h
       local.set $h|21
       local.get $cx
       local.get $r
       local.get $a
       f64.promote_f32
       call $~lib/math/NativeMath.cos
       f32.demote_f64
       f32.mul
       f32.add
       local.set $x|22
       local.get $cy
       local.get $r
       local.get $a
       f64.promote_f32
       call $~lib/math/NativeMath.sin
       f32.demote_f64
       f32.mul
       f32.add
       local.set $y|23
       block $assembly/math/isNaN|inlined.18 (result i32)
        local.get $x|22
        local.set $val
        local.get $val
        local.get $val
        f32.ne
        br $assembly/math/isNaN|inlined.18
       end
       if (result i32)
        i32.const 1
       else
        block $assembly/math/isNaN|inlined.19 (result i32)
         local.get $y|23
         local.set $val|25
         local.get $val|25
         local.get $val|25
         f32.ne
         br $assembly/math/isNaN|inlined.19
        end
       end
       if
        i32.const 0
        br $assembly/math/sampleBilinear|inlined.1
       end
       local.get $x|22
       f32.const 0
       f32.lt
       if
        f32.const 0
        local.set $x|22
       end
       local.get $y|23
       f32.const 0
       f32.lt
       if
        f32.const 0
        local.set $y|23
       end
       local.get $x|22
       local.get $w|20
       f32.convert_i32_s
       f32.const 1
       f32.sub
       f32.ge
       if
        local.get $w|20
        f64.convert_i32_s
        f64.const 1.000001
        f64.sub
        f32.demote_f64
        local.set $x|22
       end
       local.get $y|23
       local.get $h|21
       f32.convert_i32_s
       f32.const 1
       f32.sub
       f32.ge
       if
        local.get $h|21
        f64.convert_i32_s
        f64.const 1.000001
        f64.sub
        f32.demote_f64
        local.set $y|23
       end
       block $~lib/math/NativeMath.floor|inlined.3 (result f64)
        local.get $x|22
        f64.promote_f32
        local.set $x|26
        local.get $x|26
        f64.floor
        br $~lib/math/NativeMath.floor|inlined.3
       end
       i32.trunc_sat_f64_s
       local.set $x0
       block $~lib/math/NativeMath.floor|inlined.4 (result f64)
        local.get $y|23
        f64.promote_f32
        local.set $x|28
        local.get $x|28
        f64.floor
        br $~lib/math/NativeMath.floor|inlined.4
       end
       i32.trunc_sat_f64_s
       local.set $y0
       local.get $x0
       i32.const 1
       i32.add
       local.set $x1
       local.get $y0
       i32.const 1
       i32.add
       local.set $y1
       local.get $x|22
       local.get $x0
       f32.convert_i32_s
       f32.sub
       local.set $tx
       local.get $y|23
       local.get $y0
       f32.convert_i32_s
       f32.sub
       local.set $ty
       local.get $y0
       local.get $w|20
       i32.mul
       local.get $x0
       i32.add
       i32.const 2
       i32.shl
       local.set $i00
       local.get $y0
       local.get $w|20
       i32.mul
       local.get $x1
       i32.add
       i32.const 2
       i32.shl
       local.set $i10
       local.get $y1
       local.get $w|20
       i32.mul
       local.get $x0
       i32.add
       i32.const 2
       i32.shl
       local.set $i01
       local.get $y1
       local.get $w|20
       i32.mul
       local.get $x1
       i32.add
       i32.const 2
       i32.shl
       local.set $i11
       block $assembly/math/lerp|inlined.14 (result f32)
        block $assembly/math/lerp|inlined.12 (result f32)
         local.get $ptr
         local.get $i00
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|38
         local.get $ptr
         local.get $i10
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b
         local.get $tx
         local.set $t
         local.get $a|38
         local.get $b
         local.get $a|38
         f32.sub
         local.get $t
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.12
        end
        local.set $a|44
        block $assembly/math/lerp|inlined.13 (result f32)
         local.get $ptr
         local.get $i01
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|41
         local.get $ptr
         local.get $i11
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b|42
         local.get $tx
         local.set $t|43
         local.get $a|41
         local.get $b|42
         local.get $a|41
         f32.sub
         local.get $t|43
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.13
        end
        local.set $b|45
        local.get $ty
        local.set $t|46
        local.get $a|44
        local.get $b|45
        local.get $a|44
        f32.sub
        local.get $t|46
        f32.mul
        f32.add
        br $assembly/math/lerp|inlined.14
       end
       local.set $r|47
       block $assembly/math/lerp|inlined.17 (result f32)
        block $assembly/math/lerp|inlined.15 (result f32)
         local.get $ptr
         local.get $i00
         i32.add
         i32.const 1
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|48
         local.get $ptr
         local.get $i10
         i32.add
         i32.const 1
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b|49
         local.get $tx
         local.set $t|50
         local.get $a|48
         local.get $b|49
         local.get $a|48
         f32.sub
         local.get $t|50
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.15
        end
        local.set $a|54
        block $assembly/math/lerp|inlined.16 (result f32)
         local.get $ptr
         local.get $i01
         i32.add
         i32.const 1
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|51
         local.get $ptr
         local.get $i11
         i32.add
         i32.const 1
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b|52
         local.get $tx
         local.set $t|53
         local.get $a|51
         local.get $b|52
         local.get $a|51
         f32.sub
         local.get $t|53
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.16
        end
        local.set $b|55
        local.get $ty
        local.set $t|56
        local.get $a|54
        local.get $b|55
        local.get $a|54
        f32.sub
        local.get $t|56
        f32.mul
        f32.add
        br $assembly/math/lerp|inlined.17
       end
       local.set $g
       block $assembly/math/lerp|inlined.20 (result f32)
        block $assembly/math/lerp|inlined.18 (result f32)
         local.get $ptr
         local.get $i00
         i32.add
         i32.const 2
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|58
         local.get $ptr
         local.get $i10
         i32.add
         i32.const 2
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b|59
         local.get $tx
         local.set $t|60
         local.get $a|58
         local.get $b|59
         local.get $a|58
         f32.sub
         local.get $t|60
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.18
        end
        local.set $a|64
        block $assembly/math/lerp|inlined.19 (result f32)
         local.get $ptr
         local.get $i01
         i32.add
         i32.const 2
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|61
         local.get $ptr
         local.get $i11
         i32.add
         i32.const 2
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b|62
         local.get $tx
         local.set $t|63
         local.get $a|61
         local.get $b|62
         local.get $a|61
         f32.sub
         local.get $t|63
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.19
        end
        local.set $b|65
        local.get $ty
        local.set $t|66
        local.get $a|64
        local.get $b|65
        local.get $a|64
        f32.sub
        local.get $t|66
        f32.mul
        f32.add
        br $assembly/math/lerp|inlined.20
       end
       local.set $b|67
       block $assembly/math/lerp|inlined.23 (result f32)
        block $assembly/math/lerp|inlined.21 (result f32)
         local.get $ptr
         local.get $i00
         i32.add
         i32.const 3
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|68
         local.get $ptr
         local.get $i10
         i32.add
         i32.const 3
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b|69
         local.get $tx
         local.set $t|70
         local.get $a|68
         local.get $b|69
         local.get $a|68
         f32.sub
         local.get $t|70
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.21
        end
        local.set $a|74
        block $assembly/math/lerp|inlined.22 (result f32)
         local.get $ptr
         local.get $i01
         i32.add
         i32.const 3
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|71
         local.get $ptr
         local.get $i11
         i32.add
         i32.const 3
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b|72
         local.get $tx
         local.set $t|73
         local.get $a|71
         local.get $b|72
         local.get $a|71
         f32.sub
         local.get $t|73
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.22
        end
        local.set $b|75
        local.get $ty
        local.set $t|76
        local.get $a|74
        local.get $b|75
        local.get $a|74
        f32.sub
        local.get $t|76
        f32.mul
        f32.add
        br $assembly/math/lerp|inlined.23
       end
       local.set $a|77
       block $assembly/math/clamp255|inlined.13 (result i32)
        local.get $r|47
        local.set $val|78
        block $assembly/math/isNaN|inlined.20 (result i32)
         local.get $val|78
         local.set $val|79
         local.get $val|79
         local.get $val|79
         f32.ne
         br $assembly/math/isNaN|inlined.20
        end
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.13
        end
        local.get $val|78
        f32.const 0
        f32.lt
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.13
        end
        local.get $val|78
        f32.const 255
        f32.gt
        if
         i32.const 255
         br $assembly/math/clamp255|inlined.13
        end
        local.get $val|78
        i32.trunc_sat_f32_u
        br $assembly/math/clamp255|inlined.13
       end
       i32.const 255
       i32.and
       block $assembly/math/clamp255|inlined.14 (result i32)
        local.get $g
        local.set $val|80
        block $assembly/math/isNaN|inlined.21 (result i32)
         local.get $val|80
         local.set $val|81
         local.get $val|81
         local.get $val|81
         f32.ne
         br $assembly/math/isNaN|inlined.21
        end
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.14
        end
        local.get $val|80
        f32.const 0
        f32.lt
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.14
        end
        local.get $val|80
        f32.const 255
        f32.gt
        if
         i32.const 255
         br $assembly/math/clamp255|inlined.14
        end
        local.get $val|80
        i32.trunc_sat_f32_u
        br $assembly/math/clamp255|inlined.14
       end
       i32.const 255
       i32.and
       i32.const 8
       i32.shl
       i32.or
       block $assembly/math/clamp255|inlined.15 (result i32)
        local.get $b|67
        local.set $val|82
        block $assembly/math/isNaN|inlined.22 (result i32)
         local.get $val|82
         local.set $val|83
         local.get $val|83
         local.get $val|83
         f32.ne
         br $assembly/math/isNaN|inlined.22
        end
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.15
        end
        local.get $val|82
        f32.const 0
        f32.lt
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.15
        end
        local.get $val|82
        f32.const 255
        f32.gt
        if
         i32.const 255
         br $assembly/math/clamp255|inlined.15
        end
        local.get $val|82
        i32.trunc_sat_f32_u
        br $assembly/math/clamp255|inlined.15
       end
       i32.const 255
       i32.and
       i32.const 16
       i32.shl
       i32.or
       block $assembly/math/clamp255|inlined.16 (result i32)
        local.get $a|77
        local.set $val|84
        block $assembly/math/isNaN|inlined.23 (result i32)
         local.get $val|84
         local.set $val|85
         local.get $val|85
         local.get $val|85
         f32.ne
         br $assembly/math/isNaN|inlined.23
        end
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.16
        end
        local.get $val|84
        f32.const 0
        f32.lt
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.16
        end
        local.get $val|84
        f32.const 255
        f32.gt
        if
         i32.const 255
         br $assembly/math/clamp255|inlined.16
        end
        local.get $val|84
        i32.trunc_sat_f32_u
        br $assembly/math/clamp255|inlined.16
       end
       i32.const 255
       i32.and
       i32.const 24
       i32.shl
       i32.or
       br $assembly/math/sampleBilinear|inlined.1
      end
      i32.store
      local.get $x|14
      i32.const 1
      i32.add
      local.set $x|14
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/pinch (param $srcPtr i32) (param $dstPtr i32) (param $w i32) (param $h i32) (param $amount f32) (param $startY i32) (param $endY i32)
  (local $cx f32)
  (local $cy f32)
  (local $value1 f64)
  (local $value2 f64)
  (local $radius f32)
  (local $y i32)
  (local $row i32)
  (local $dy f32)
  (local $x i32)
  (local $dx f32)
  (local $d2 f32)
  (local $x|18 f64)
  (local $r f32)
  (local $t f32)
  (local $ptr i32)
  (local $w|22 i32)
  (local $h|23 i32)
  (local $x|24 f32)
  (local $y|25 f32)
  (local $val f32)
  (local $val|27 f32)
  (local $x|28 f64)
  (local $x0 i32)
  (local $x|30 f64)
  (local $y0 i32)
  (local $x1 i32)
  (local $y1 i32)
  (local $tx f32)
  (local $ty f32)
  (local $i00 i32)
  (local $i10 i32)
  (local $i01 i32)
  (local $i11 i32)
  (local $a f32)
  (local $b f32)
  (local $t|42 f32)
  (local $a|43 f32)
  (local $b|44 f32)
  (local $t|45 f32)
  (local $a|46 f32)
  (local $b|47 f32)
  (local $t|48 f32)
  (local $r|49 f32)
  (local $a|50 f32)
  (local $b|51 f32)
  (local $t|52 f32)
  (local $a|53 f32)
  (local $b|54 f32)
  (local $t|55 f32)
  (local $a|56 f32)
  (local $b|57 f32)
  (local $t|58 f32)
  (local $g f32)
  (local $a|60 f32)
  (local $b|61 f32)
  (local $t|62 f32)
  (local $a|63 f32)
  (local $b|64 f32)
  (local $t|65 f32)
  (local $a|66 f32)
  (local $b|67 f32)
  (local $t|68 f32)
  (local $b|69 f32)
  (local $a|70 f32)
  (local $b|71 f32)
  (local $t|72 f32)
  (local $a|73 f32)
  (local $b|74 f32)
  (local $t|75 f32)
  (local $a|76 f32)
  (local $b|77 f32)
  (local $t|78 f32)
  (local $a|79 f32)
  (local $val|80 f32)
  (local $val|81 f32)
  (local $val|82 f32)
  (local $val|83 f32)
  (local $val|84 f32)
  (local $val|85 f32)
  (local $val|86 f32)
  (local $val|87 f32)
  local.get $w
  f32.convert_i32_s
  f32.const 2
  f32.div
  local.set $cx
  local.get $h
  f32.convert_i32_s
  f32.const 2
  f32.div
  local.set $cy
  block $~lib/math/NativeMath.min|inlined.5 (result f64)
   local.get $w
   f64.convert_i32_s
   local.set $value1
   local.get $h
   f64.convert_i32_s
   local.set $value2
   local.get $value1
   local.get $value2
   f64.min
   br $~lib/math/NativeMath.min|inlined.5
  end
  f32.demote_f64
  f32.const 2
  f32.div
  local.set $radius
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    local.get $y
    f32.convert_i32_s
    local.get $cy
    f32.sub
    local.set $dy
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $w
     i32.lt_s
     if
      local.get $x
      f32.convert_i32_s
      local.get $cx
      f32.sub
      local.set $dx
      local.get $dx
      local.get $dx
      f32.mul
      local.get $dy
      local.get $dy
      f32.mul
      f32.add
      local.set $d2
      block $~lib/math/NativeMath.sqrt|inlined.3 (result f64)
       local.get $d2
       f64.promote_f32
       local.set $x|18
       local.get $x|18
       f64.sqrt
       br $~lib/math/NativeMath.sqrt|inlined.3
      end
      f32.demote_f64
      local.set $r
      local.get $r
      local.get $radius
      f32.lt
      if
       local.get $r
       local.get $radius
       f32.div
       f64.promote_f32
       local.get $amount
       f64.promote_f32
       call $~lib/math/NativeMath.pow
       f32.demote_f64
       local.set $t
       local.get $dstPtr
       local.get $row
       i32.add
       local.get $x
       i32.const 2
       i32.shl
       i32.add
       block $assembly/math/sampleBilinear|inlined.2 (result i32)
        local.get $srcPtr
        local.set $ptr
        local.get $w
        local.set $w|22
        local.get $h
        local.set $h|23
        local.get $cx
        local.get $dx
        local.get $t
        f32.mul
        f32.add
        local.set $x|24
        local.get $cy
        local.get $dy
        local.get $t
        f32.mul
        f32.add
        local.set $y|25
        block $assembly/math/isNaN|inlined.24 (result i32)
         local.get $x|24
         local.set $val
         local.get $val
         local.get $val
         f32.ne
         br $assembly/math/isNaN|inlined.24
        end
        if (result i32)
         i32.const 1
        else
         block $assembly/math/isNaN|inlined.25 (result i32)
          local.get $y|25
          local.set $val|27
          local.get $val|27
          local.get $val|27
          f32.ne
          br $assembly/math/isNaN|inlined.25
         end
        end
        if
         i32.const 0
         br $assembly/math/sampleBilinear|inlined.2
        end
        local.get $x|24
        f32.const 0
        f32.lt
        if
         f32.const 0
         local.set $x|24
        end
        local.get $y|25
        f32.const 0
        f32.lt
        if
         f32.const 0
         local.set $y|25
        end
        local.get $x|24
        local.get $w|22
        f32.convert_i32_s
        f32.const 1
        f32.sub
        f32.ge
        if
         local.get $w|22
         f64.convert_i32_s
         f64.const 1.000001
         f64.sub
         f32.demote_f64
         local.set $x|24
        end
        local.get $y|25
        local.get $h|23
        f32.convert_i32_s
        f32.const 1
        f32.sub
        f32.ge
        if
         local.get $h|23
         f64.convert_i32_s
         f64.const 1.000001
         f64.sub
         f32.demote_f64
         local.set $y|25
        end
        block $~lib/math/NativeMath.floor|inlined.5 (result f64)
         local.get $x|24
         f64.promote_f32
         local.set $x|28
         local.get $x|28
         f64.floor
         br $~lib/math/NativeMath.floor|inlined.5
        end
        i32.trunc_sat_f64_s
        local.set $x0
        block $~lib/math/NativeMath.floor|inlined.6 (result f64)
         local.get $y|25
         f64.promote_f32
         local.set $x|30
         local.get $x|30
         f64.floor
         br $~lib/math/NativeMath.floor|inlined.6
        end
        i32.trunc_sat_f64_s
        local.set $y0
        local.get $x0
        i32.const 1
        i32.add
        local.set $x1
        local.get $y0
        i32.const 1
        i32.add
        local.set $y1
        local.get $x|24
        local.get $x0
        f32.convert_i32_s
        f32.sub
        local.set $tx
        local.get $y|25
        local.get $y0
        f32.convert_i32_s
        f32.sub
        local.set $ty
        local.get $y0
        local.get $w|22
        i32.mul
        local.get $x0
        i32.add
        i32.const 2
        i32.shl
        local.set $i00
        local.get $y0
        local.get $w|22
        i32.mul
        local.get $x1
        i32.add
        i32.const 2
        i32.shl
        local.set $i10
        local.get $y1
        local.get $w|22
        i32.mul
        local.get $x0
        i32.add
        i32.const 2
        i32.shl
        local.set $i01
        local.get $y1
        local.get $w|22
        i32.mul
        local.get $x1
        i32.add
        i32.const 2
        i32.shl
        local.set $i11
        block $assembly/math/lerp|inlined.26 (result f32)
         block $assembly/math/lerp|inlined.24 (result f32)
          local.get $ptr
          local.get $i00
          i32.add
          i32.load8_u
          f32.convert_i32_u
          local.set $a
          local.get $ptr
          local.get $i10
          i32.add
          i32.load8_u
          f32.convert_i32_u
          local.set $b
          local.get $tx
          local.set $t|42
          local.get $a
          local.get $b
          local.get $a
          f32.sub
          local.get $t|42
          f32.mul
          f32.add
          br $assembly/math/lerp|inlined.24
         end
         local.set $a|46
         block $assembly/math/lerp|inlined.25 (result f32)
          local.get $ptr
          local.get $i01
          i32.add
          i32.load8_u
          f32.convert_i32_u
          local.set $a|43
          local.get $ptr
          local.get $i11
          i32.add
          i32.load8_u
          f32.convert_i32_u
          local.set $b|44
          local.get $tx
          local.set $t|45
          local.get $a|43
          local.get $b|44
          local.get $a|43
          f32.sub
          local.get $t|45
          f32.mul
          f32.add
          br $assembly/math/lerp|inlined.25
         end
         local.set $b|47
         local.get $ty
         local.set $t|48
         local.get $a|46
         local.get $b|47
         local.get $a|46
         f32.sub
         local.get $t|48
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.26
        end
        local.set $r|49
        block $assembly/math/lerp|inlined.29 (result f32)
         block $assembly/math/lerp|inlined.27 (result f32)
          local.get $ptr
          local.get $i00
          i32.add
          i32.const 1
          i32.add
          i32.load8_u
          f32.convert_i32_u
          local.set $a|50
          local.get $ptr
          local.get $i10
          i32.add
          i32.const 1
          i32.add
          i32.load8_u
          f32.convert_i32_u
          local.set $b|51
          local.get $tx
          local.set $t|52
          local.get $a|50
          local.get $b|51
          local.get $a|50
          f32.sub
          local.get $t|52
          f32.mul
          f32.add
          br $assembly/math/lerp|inlined.27
         end
         local.set $a|56
         block $assembly/math/lerp|inlined.28 (result f32)
          local.get $ptr
          local.get $i01
          i32.add
          i32.const 1
          i32.add
          i32.load8_u
          f32.convert_i32_u
          local.set $a|53
          local.get $ptr
          local.get $i11
          i32.add
          i32.const 1
          i32.add
          i32.load8_u
          f32.convert_i32_u
          local.set $b|54
          local.get $tx
          local.set $t|55
          local.get $a|53
          local.get $b|54
          local.get $a|53
          f32.sub
          local.get $t|55
          f32.mul
          f32.add
          br $assembly/math/lerp|inlined.28
         end
         local.set $b|57
         local.get $ty
         local.set $t|58
         local.get $a|56
         local.get $b|57
         local.get $a|56
         f32.sub
         local.get $t|58
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.29
        end
        local.set $g
        block $assembly/math/lerp|inlined.32 (result f32)
         block $assembly/math/lerp|inlined.30 (result f32)
          local.get $ptr
          local.get $i00
          i32.add
          i32.const 2
          i32.add
          i32.load8_u
          f32.convert_i32_u
          local.set $a|60
          local.get $ptr
          local.get $i10
          i32.add
          i32.const 2
          i32.add
          i32.load8_u
          f32.convert_i32_u
          local.set $b|61
          local.get $tx
          local.set $t|62
          local.get $a|60
          local.get $b|61
          local.get $a|60
          f32.sub
          local.get $t|62
          f32.mul
          f32.add
          br $assembly/math/lerp|inlined.30
         end
         local.set $a|66
         block $assembly/math/lerp|inlined.31 (result f32)
          local.get $ptr
          local.get $i01
          i32.add
          i32.const 2
          i32.add
          i32.load8_u
          f32.convert_i32_u
          local.set $a|63
          local.get $ptr
          local.get $i11
          i32.add
          i32.const 2
          i32.add
          i32.load8_u
          f32.convert_i32_u
          local.set $b|64
          local.get $tx
          local.set $t|65
          local.get $a|63
          local.get $b|64
          local.get $a|63
          f32.sub
          local.get $t|65
          f32.mul
          f32.add
          br $assembly/math/lerp|inlined.31
         end
         local.set $b|67
         local.get $ty
         local.set $t|68
         local.get $a|66
         local.get $b|67
         local.get $a|66
         f32.sub
         local.get $t|68
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.32
        end
        local.set $b|69
        block $assembly/math/lerp|inlined.35 (result f32)
         block $assembly/math/lerp|inlined.33 (result f32)
          local.get $ptr
          local.get $i00
          i32.add
          i32.const 3
          i32.add
          i32.load8_u
          f32.convert_i32_u
          local.set $a|70
          local.get $ptr
          local.get $i10
          i32.add
          i32.const 3
          i32.add
          i32.load8_u
          f32.convert_i32_u
          local.set $b|71
          local.get $tx
          local.set $t|72
          local.get $a|70
          local.get $b|71
          local.get $a|70
          f32.sub
          local.get $t|72
          f32.mul
          f32.add
          br $assembly/math/lerp|inlined.33
         end
         local.set $a|76
         block $assembly/math/lerp|inlined.34 (result f32)
          local.get $ptr
          local.get $i01
          i32.add
          i32.const 3
          i32.add
          i32.load8_u
          f32.convert_i32_u
          local.set $a|73
          local.get $ptr
          local.get $i11
          i32.add
          i32.const 3
          i32.add
          i32.load8_u
          f32.convert_i32_u
          local.set $b|74
          local.get $tx
          local.set $t|75
          local.get $a|73
          local.get $b|74
          local.get $a|73
          f32.sub
          local.get $t|75
          f32.mul
          f32.add
          br $assembly/math/lerp|inlined.34
         end
         local.set $b|77
         local.get $ty
         local.set $t|78
         local.get $a|76
         local.get $b|77
         local.get $a|76
         f32.sub
         local.get $t|78
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.35
        end
        local.set $a|79
        block $assembly/math/clamp255|inlined.17 (result i32)
         local.get $r|49
         local.set $val|80
         block $assembly/math/isNaN|inlined.26 (result i32)
          local.get $val|80
          local.set $val|81
          local.get $val|81
          local.get $val|81
          f32.ne
          br $assembly/math/isNaN|inlined.26
         end
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.17
         end
         local.get $val|80
         f32.const 0
         f32.lt
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.17
         end
         local.get $val|80
         f32.const 255
         f32.gt
         if
          i32.const 255
          br $assembly/math/clamp255|inlined.17
         end
         local.get $val|80
         i32.trunc_sat_f32_u
         br $assembly/math/clamp255|inlined.17
        end
        i32.const 255
        i32.and
        block $assembly/math/clamp255|inlined.18 (result i32)
         local.get $g
         local.set $val|82
         block $assembly/math/isNaN|inlined.27 (result i32)
          local.get $val|82
          local.set $val|83
          local.get $val|83
          local.get $val|83
          f32.ne
          br $assembly/math/isNaN|inlined.27
         end
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.18
         end
         local.get $val|82
         f32.const 0
         f32.lt
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.18
         end
         local.get $val|82
         f32.const 255
         f32.gt
         if
          i32.const 255
          br $assembly/math/clamp255|inlined.18
         end
         local.get $val|82
         i32.trunc_sat_f32_u
         br $assembly/math/clamp255|inlined.18
        end
        i32.const 255
        i32.and
        i32.const 8
        i32.shl
        i32.or
        block $assembly/math/clamp255|inlined.19 (result i32)
         local.get $b|69
         local.set $val|84
         block $assembly/math/isNaN|inlined.28 (result i32)
          local.get $val|84
          local.set $val|85
          local.get $val|85
          local.get $val|85
          f32.ne
          br $assembly/math/isNaN|inlined.28
         end
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.19
         end
         local.get $val|84
         f32.const 0
         f32.lt
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.19
         end
         local.get $val|84
         f32.const 255
         f32.gt
         if
          i32.const 255
          br $assembly/math/clamp255|inlined.19
         end
         local.get $val|84
         i32.trunc_sat_f32_u
         br $assembly/math/clamp255|inlined.19
        end
        i32.const 255
        i32.and
        i32.const 16
        i32.shl
        i32.or
        block $assembly/math/clamp255|inlined.20 (result i32)
         local.get $a|79
         local.set $val|86
         block $assembly/math/isNaN|inlined.29 (result i32)
          local.get $val|86
          local.set $val|87
          local.get $val|87
          local.get $val|87
          f32.ne
          br $assembly/math/isNaN|inlined.29
         end
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.20
         end
         local.get $val|86
         f32.const 0
         f32.lt
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.20
         end
         local.get $val|86
         f32.const 255
         f32.gt
         if
          i32.const 255
          br $assembly/math/clamp255|inlined.20
         end
         local.get $val|86
         i32.trunc_sat_f32_u
         br $assembly/math/clamp255|inlined.20
        end
        i32.const 255
        i32.and
        i32.const 24
        i32.shl
        i32.or
        br $assembly/math/sampleBilinear|inlined.2
       end
       i32.store
      else
       local.get $dstPtr
       local.get $row
       i32.add
       local.get $x
       i32.const 2
       i32.shl
       i32.add
       local.get $srcPtr
       local.get $row
       i32.add
       local.get $x
       i32.const 2
       i32.shl
       i32.add
       i32.load
       i32.store
      end
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/vignette (param $srcPtr i32) (param $w i32) (param $h i32) (param $amount f32) (param $r i32) (param $g i32) (param $b i32) (param $blend i32) (param $startY i32) (param $endY i32)
  (local $cx f32)
  (local $cy f32)
  (local $x f64)
  (local $maxD f32)
  (local $mR f32)
  (local $mG f32)
  (local $mB f32)
  (local $y i32)
  (local $row i32)
  (local $dy2 f32)
  (local $x|20 i32)
  (local $idx i32)
  (local $dx2 f32)
  (local $x|23 f64)
  (local $dist f32)
  (local $d f32)
  (local $mask f32)
  (local $t f32)
  (local $oR f32)
  (local $oG f32)
  (local $oB f32)
  (local $fR f32)
  (local $fG f32)
  (local $fB f32)
  (local $val f32)
  (local $val|35 f32)
  (local $val|36 f32)
  (local $val|37 f32)
  (local $val|38 f32)
  (local $val|39 f32)
  local.get $w
  f32.convert_i32_s
  f32.const 2
  f32.div
  local.set $cx
  local.get $h
  f32.convert_i32_s
  f32.const 2
  f32.div
  local.set $cy
  block $~lib/math/NativeMath.sqrt|inlined.4 (result f64)
   local.get $cx
   local.get $cx
   f32.mul
   local.get $cy
   local.get $cy
   f32.mul
   f32.add
   f64.promote_f32
   local.set $x
   local.get $x
   f64.sqrt
   br $~lib/math/NativeMath.sqrt|inlined.4
  end
  f32.demote_f64
  local.set $maxD
  local.get $r
  i32.const 255
  i32.and
  f32.convert_i32_u
  f32.const 255
  f32.div
  local.set $mR
  local.get $g
  i32.const 255
  i32.and
  f32.convert_i32_u
  f32.const 255
  f32.div
  local.set $mG
  local.get $b
  i32.const 255
  i32.and
  f32.convert_i32_u
  f32.const 255
  f32.div
  local.set $mB
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    local.get $y
    f32.convert_i32_s
    local.get $cy
    f32.sub
    local.get $y
    f32.convert_i32_s
    local.get $cy
    f32.sub
    f32.mul
    local.set $dy2
    i32.const 0
    local.set $x|20
    loop $for-loop|1
     local.get $x|20
     local.get $w
     i32.lt_s
     if
      local.get $row
      local.get $x|20
      i32.const 2
      i32.shl
      i32.add
      local.set $idx
      local.get $x|20
      f32.convert_i32_s
      local.get $cx
      f32.sub
      local.get $x|20
      f32.convert_i32_s
      local.get $cx
      f32.sub
      f32.mul
      local.set $dx2
      block $~lib/math/NativeMath.sqrt|inlined.5 (result f64)
       local.get $dx2
       local.get $dy2
       f32.add
       f64.promote_f32
       local.set $x|23
       local.get $x|23
       f64.sqrt
       br $~lib/math/NativeMath.sqrt|inlined.5
      end
      f32.demote_f64
      local.get $maxD
      f32.div
      local.set $dist
      local.get $dist
      local.get $amount
      f32.mul
      f32.const 2
      f32.mul
      local.set $d
      f32.const 0
      local.set $mask
      local.get $d
      f32.const 0.20000000298023224
      f32.le
      if
       f32.const 1
       local.set $mask
      else
       local.get $d
       f32.const 0.800000011920929
       f32.ge
       if
        f32.const 0
        local.set $mask
       else
        local.get $d
        f32.const 0.800000011920929
        f32.sub
        f32.const 0.20000000298023224
        f32.const 0.800000011920929
        f32.sub
        f32.div
        local.set $t
        local.get $t
        local.get $t
        f32.mul
        f32.const 3
        f32.const 2
        local.get $t
        f32.mul
        f32.sub
        f32.mul
        local.set $mask
       end
      end
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.load8_u
      f32.convert_i32_u
      f32.const 255
      f32.div
      local.set $oR
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 1
      i32.add
      i32.load8_u
      f32.convert_i32_u
      f32.const 255
      f32.div
      local.set $oG
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 2
      i32.add
      i32.load8_u
      f32.convert_i32_u
      f32.const 255
      f32.div
      local.set $oB
      local.get $oR
      local.set $fR
      local.get $oG
      local.set $fG
      local.get $oB
      local.set $fB
      local.get $blend
      i32.const 1
      i32.eq
      if
       local.get $oR
       local.get $mR
       f32.mul
       local.set $fR
       local.get $oG
       local.get $mG
       f32.mul
       local.set $fG
       local.get $oB
       local.get $mB
       f32.mul
       local.set $fB
      else
       local.get $blend
       i32.const 2
       i32.eq
       if
        f32.const 1
        f32.const 1
        local.get $oR
        f32.sub
        f32.const 1
        local.get $mR
        f32.sub
        f32.mul
        f32.sub
        local.set $fR
        f32.const 1
        f32.const 1
        local.get $oG
        f32.sub
        f32.const 1
        local.get $mG
        f32.sub
        f32.mul
        f32.sub
        local.set $fG
        f32.const 1
        f32.const 1
        local.get $oB
        f32.sub
        f32.const 1
        local.get $mB
        f32.sub
        f32.mul
        f32.sub
        local.set $fB
       else
        local.get $blend
        i32.const 3
        i32.eq
        if
         local.get $oR
         f32.const 0.5
         f32.lt
         if (result f32)
          f32.const 2
          local.get $oR
          f32.mul
          local.get $mR
          f32.mul
         else
          f32.const 1
          f32.const 2
          f32.const 1
          local.get $oR
          f32.sub
          f32.mul
          f32.const 1
          local.get $mR
          f32.sub
          f32.mul
          f32.sub
         end
         local.set $fR
         local.get $oG
         f32.const 0.5
         f32.lt
         if (result f32)
          f32.const 2
          local.get $oG
          f32.mul
          local.get $mG
          f32.mul
         else
          f32.const 1
          f32.const 2
          f32.const 1
          local.get $oG
          f32.sub
          f32.mul
          f32.const 1
          local.get $mG
          f32.sub
          f32.mul
          f32.sub
         end
         local.set $fG
         local.get $oB
         f32.const 0.5
         f32.lt
         if (result f32)
          f32.const 2
          local.get $oB
          f32.mul
          local.get $mB
          f32.mul
         else
          f32.const 1
          f32.const 2
          f32.const 1
          local.get $oB
          f32.sub
          f32.mul
          f32.const 1
          local.get $mB
          f32.sub
          f32.mul
          f32.sub
         end
         local.set $fB
        else
         local.get $mR
         local.set $fR
         local.get $mG
         local.set $fG
         local.get $mB
         local.set $fB
        end
       end
      end
      local.get $srcPtr
      local.get $idx
      i32.add
      block $assembly/math/clamp255|inlined.21 (result i32)
       local.get $oR
       local.get $mask
       f32.mul
       local.get $fR
       f32.const 1
       local.get $mask
       f32.sub
       f32.mul
       f32.add
       f32.const 255
       f32.mul
       local.set $val
       block $assembly/math/isNaN|inlined.30 (result i32)
        local.get $val
        local.set $val|35
        local.get $val|35
        local.get $val|35
        f32.ne
        br $assembly/math/isNaN|inlined.30
       end
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.21
       end
       local.get $val
       f32.const 0
       f32.lt
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.21
       end
       local.get $val
       f32.const 255
       f32.gt
       if
        i32.const 255
        br $assembly/math/clamp255|inlined.21
       end
       local.get $val
       i32.trunc_sat_f32_u
       br $assembly/math/clamp255|inlined.21
      end
      i32.store8
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 1
      i32.add
      block $assembly/math/clamp255|inlined.22 (result i32)
       local.get $oG
       local.get $mask
       f32.mul
       local.get $fG
       f32.const 1
       local.get $mask
       f32.sub
       f32.mul
       f32.add
       f32.const 255
       f32.mul
       local.set $val|36
       block $assembly/math/isNaN|inlined.31 (result i32)
        local.get $val|36
        local.set $val|37
        local.get $val|37
        local.get $val|37
        f32.ne
        br $assembly/math/isNaN|inlined.31
       end
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.22
       end
       local.get $val|36
       f32.const 0
       f32.lt
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.22
       end
       local.get $val|36
       f32.const 255
       f32.gt
       if
        i32.const 255
        br $assembly/math/clamp255|inlined.22
       end
       local.get $val|36
       i32.trunc_sat_f32_u
       br $assembly/math/clamp255|inlined.22
      end
      i32.store8
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 2
      i32.add
      block $assembly/math/clamp255|inlined.23 (result i32)
       local.get $oB
       local.get $mask
       f32.mul
       local.get $fB
       f32.const 1
       local.get $mask
       f32.sub
       f32.mul
       f32.add
       f32.const 255
       f32.mul
       local.set $val|38
       block $assembly/math/isNaN|inlined.32 (result i32)
        local.get $val|38
        local.set $val|39
        local.get $val|39
        local.get $val|39
        f32.ne
        br $assembly/math/isNaN|inlined.32
       end
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.23
       end
       local.get $val|38
       f32.const 0
       f32.lt
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.23
       end
       local.get $val|38
       f32.const 255
       f32.gt
       if
        i32.const 255
        br $assembly/math/clamp255|inlined.23
       end
       local.get $val|38
       i32.trunc_sat_f32_u
       br $assembly/math/clamp255|inlined.23
      end
      i32.store8
      local.get $x|20
      i32.const 1
      i32.add
      local.set $x|20
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/adjustBCS (param $srcPtr i32) (param $w i32) (param $h i32) (param $brightness f32) (param $contrast f32) (param $startY i32) (param $endY i32)
  (local $b f32)
  (local $c f32)
  (local $y i32)
  (local $row i32)
  (local $x i32)
  (local $idx i32)
  (local $i i32)
  (local $v f32)
  (local $val f32)
  (local $val|16 f32)
  local.get $brightness
  f32.const 100
  f32.div
  local.set $b
  local.get $contrast
  f32.const 100
  f32.add
  f32.const 100
  f32.div
  local.set $c
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $w
     i32.lt_s
     if
      local.get $row
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      local.set $idx
      i32.const 0
      local.set $i
      loop $for-loop|2
       local.get $i
       i32.const 3
       i32.lt_u
       if
        local.get $srcPtr
        local.get $idx
        i32.add
        local.get $i
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.const 255
        f32.div
        local.set $v
        local.get $v
        f32.const 0.5
        f32.sub
        local.get $c
        f32.mul
        f32.const 0.5
        f32.add
        local.get $b
        f32.add
        local.set $v
        local.get $srcPtr
        local.get $idx
        i32.add
        local.get $i
        i32.add
        block $assembly/math/clamp255|inlined.24 (result i32)
         local.get $v
         f32.const 255
         f32.mul
         local.set $val
         block $assembly/math/isNaN|inlined.33 (result i32)
          local.get $val
          local.set $val|16
          local.get $val|16
          local.get $val|16
          f32.ne
          br $assembly/math/isNaN|inlined.33
         end
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.24
         end
         local.get $val
         f32.const 0
         f32.lt
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.24
         end
         local.get $val
         f32.const 255
         f32.gt
         if
          i32.const 255
          br $assembly/math/clamp255|inlined.24
         end
         local.get $val
         i32.trunc_sat_f32_u
         br $assembly/math/clamp255|inlined.24
        end
        i32.store8
        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $for-loop|2
       end
      end
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/invert (param $srcPtr i32) (param $w i32) (param $h i32) (param $startY i32) (param $endY i32)
  (local $y i32)
  (local $row i32)
  (local $x i32)
  (local $idx i32)
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $w
     i32.lt_s
     if
      local.get $row
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      local.set $idx
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 255
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.load8_u
      i32.sub
      i32.store8
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 1
      i32.add
      i32.const 255
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 1
      i32.add
      i32.load8_u
      i32.sub
      i32.store8
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 2
      i32.add
      i32.const 255
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 2
      i32.add
      i32.load8_u
      i32.sub
      i32.store8
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/grayscale (param $srcPtr i32) (param $w i32) (param $h i32) (param $startY i32) (param $endY i32)
  (local $y i32)
  (local $row i32)
  (local $x i32)
  (local $idx i32)
  (local $r i32)
  (local $g i32)
  (local $b i32)
  (local $gray i32)
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $w
     i32.lt_s
     if
      local.get $row
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      local.set $idx
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.load8_u
      local.set $r
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 1
      i32.add
      i32.load8_u
      local.set $g
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 2
      i32.add
      i32.load8_u
      local.set $b
      f64.const 0.299
      local.get $r
      f32.convert_i32_u
      f64.promote_f32
      f64.mul
      f64.const 0.587
      local.get $g
      f32.convert_i32_u
      f64.promote_f32
      f64.mul
      f64.add
      f64.const 0.114
      local.get $b
      f32.convert_i32_u
      f64.promote_f32
      f64.mul
      f64.add
      i32.trunc_sat_f64_u
      local.set $gray
      local.get $srcPtr
      local.get $idx
      i32.add
      local.get $gray
      i32.store8
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 1
      i32.add
      local.get $gray
      i32.store8
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 2
      i32.add
      local.get $gray
      i32.store8
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/posterize (param $srcPtr i32) (param $w i32) (param $h i32) (param $levels f32) (param $startY i32) (param $endY i32)
  (local $step f64)
  (local $y i32)
  (local $row i32)
  (local $x i32)
  (local $idx i32)
  (local $x|11 f64)
  (local $x|12 f64)
  (local $x|13 f64)
  f64.const 255
  local.get $levels
  f32.const 1
  f32.sub
  f64.promote_f32
  f64.div
  local.set $step
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $w
     i32.lt_s
     if
      local.get $row
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      local.set $idx
      local.get $srcPtr
      local.get $idx
      i32.add
      block $~lib/math/NativeMath.floor|inlined.7 (result f64)
       local.get $srcPtr
       local.get $idx
       i32.add
       i32.load8_u
       f64.convert_i32_u
       local.get $step
       f64.div
       local.set $x|11
       local.get $x|11
       f64.floor
       br $~lib/math/NativeMath.floor|inlined.7
      end
      local.get $step
      f64.mul
      i32.trunc_sat_f64_u
      i32.store8
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 1
      i32.add
      block $~lib/math/NativeMath.floor|inlined.8 (result f64)
       local.get $srcPtr
       local.get $idx
       i32.add
       i32.const 1
       i32.add
       i32.load8_u
       f64.convert_i32_u
       local.get $step
       f64.div
       local.set $x|12
       local.get $x|12
       f64.floor
       br $~lib/math/NativeMath.floor|inlined.8
      end
      local.get $step
      f64.mul
      i32.trunc_sat_f64_u
      i32.store8
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 2
      i32.add
      block $~lib/math/NativeMath.floor|inlined.9 (result f64)
       local.get $srcPtr
       local.get $idx
       i32.add
       i32.const 2
       i32.add
       i32.load8_u
       f64.convert_i32_u
       local.get $step
       f64.div
       local.set $x|13
       local.get $x|13
       f64.floor
       br $~lib/math/NativeMath.floor|inlined.9
      end
      local.get $step
      f64.mul
      i32.trunc_sat_f64_u
      i32.store8
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/boxBlur (param $srcPtr i32) (param $dstPtr i32) (param $w i32) (param $h i32) (param $radius i32) (param $startY i32) (param $endY i32)
  (local $y i32)
  (local $row i32)
  (local $x i32)
  (local $r i32)
  (local $g i32)
  (local $b i32)
  (local $count i32)
  (local $ky i32)
  (local $py i32)
  (local $kx i32)
  (local $px i32)
  (local $kidx i32)
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $w
     i32.lt_s
     if
      i32.const 0
      local.set $r
      i32.const 0
      local.set $g
      i32.const 0
      local.set $b
      i32.const 0
      local.set $count
      i32.const 0
      local.get $radius
      i32.sub
      local.set $ky
      loop $for-loop|2
       local.get $ky
       local.get $radius
       i32.le_s
       if
        block $for-continue|2
         local.get $y
         local.get $ky
         i32.add
         local.set $py
         local.get $py
         i32.const 0
         i32.lt_s
         if (result i32)
          i32.const 1
         else
          local.get $py
          local.get $h
          i32.ge_s
         end
         if
          br $for-continue|2
         end
         i32.const 0
         local.get $radius
         i32.sub
         local.set $kx
         loop $for-loop|3
          local.get $kx
          local.get $radius
          i32.le_s
          if
           block $for-continue|3
            local.get $x
            local.get $kx
            i32.add
            local.set $px
            local.get $px
            i32.const 0
            i32.lt_s
            if (result i32)
             i32.const 1
            else
             local.get $px
             local.get $w
             i32.ge_s
            end
            if
             br $for-continue|3
            end
            local.get $py
            local.get $w
            i32.mul
            local.get $px
            i32.add
            i32.const 2
            i32.shl
            local.set $kidx
            local.get $r
            local.get $srcPtr
            local.get $kidx
            i32.add
            i32.load8_u
            i32.add
            local.set $r
            local.get $g
            local.get $srcPtr
            local.get $kidx
            i32.add
            i32.const 1
            i32.add
            i32.load8_u
            i32.add
            local.set $g
            local.get $b
            local.get $srcPtr
            local.get $kidx
            i32.add
            i32.const 2
            i32.add
            i32.load8_u
            i32.add
            local.set $b
            local.get $count
            i32.const 1
            i32.add
            local.set $count
           end
           local.get $kx
           i32.const 1
           i32.add
           local.set $kx
           br $for-loop|3
          end
         end
        end
        local.get $ky
        i32.const 1
        i32.add
        local.set $ky
        br $for-loop|2
       end
      end
      local.get $dstPtr
      local.get $row
      i32.add
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      local.get $r
      local.get $count
      i32.div_u
      i32.store8
      local.get $dstPtr
      local.get $row
      i32.add
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      i32.const 1
      i32.add
      local.get $g
      local.get $count
      i32.div_u
      i32.store8
      local.get $dstPtr
      local.get $row
      i32.add
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      i32.const 2
      i32.add
      local.get $b
      local.get $count
      i32.div_u
      i32.store8
      local.get $dstPtr
      local.get $row
      i32.add
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      i32.const 3
      i32.add
      local.get $srcPtr
      local.get $row
      i32.add
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      i32.const 3
      i32.add
      i32.load8_u
      i32.store8
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/crystallize (param $srcPtr i32) (param $dstPtr i32) (param $w i32) (param $h i32) (param $size f32) (param $startY i32) (param $endY i32)
  (local $y i32)
  (local $row i32)
  (local $x f64)
  (local $cy i32)
  (local $value1 f64)
  (local $value2 f64)
  (local $cyClamped i32)
  (local $x|14 i32)
  (local $x|15 f64)
  (local $cx i32)
  (local $value1|17 f64)
  (local $value2|18 f64)
  (local $cxClamped i32)
  (local $srcIdx i32)
  local.get $size
  f32.const 1
  f32.lt
  if
   f32.const 1
   local.set $size
  end
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    block $~lib/math/NativeMath.floor|inlined.10 (result f64)
     local.get $y
     f64.convert_i32_s
     local.get $size
     f64.promote_f32
     f64.div
     local.set $x
     local.get $x
     f64.floor
     br $~lib/math/NativeMath.floor|inlined.10
    end
    local.get $size
    f64.promote_f32
    f64.mul
    local.get $size
    f64.promote_f32
    f64.const 2
    f64.div
    f64.add
    i32.trunc_sat_f64_s
    local.set $cy
    block $~lib/math/NativeMath.min|inlined.6 (result f64)
     local.get $h
     f64.convert_i32_s
     f64.const 1
     f64.sub
     local.set $value1
     local.get $cy
     f64.convert_i32_s
     local.set $value2
     local.get $value1
     local.get $value2
     f64.min
     br $~lib/math/NativeMath.min|inlined.6
    end
    i32.trunc_sat_f64_u
    local.set $cyClamped
    i32.const 0
    local.set $x|14
    loop $for-loop|1
     local.get $x|14
     local.get $w
     i32.lt_s
     if
      block $~lib/math/NativeMath.floor|inlined.11 (result f64)
       local.get $x|14
       f64.convert_i32_s
       local.get $size
       f64.promote_f32
       f64.div
       local.set $x|15
       local.get $x|15
       f64.floor
       br $~lib/math/NativeMath.floor|inlined.11
      end
      local.get $size
      f64.promote_f32
      f64.mul
      local.get $size
      f64.promote_f32
      f64.const 2
      f64.div
      f64.add
      i32.trunc_sat_f64_s
      local.set $cx
      block $~lib/math/NativeMath.min|inlined.7 (result f64)
       local.get $w
       f64.convert_i32_s
       f64.const 1
       f64.sub
       local.set $value1|17
       local.get $cx
       f64.convert_i32_s
       local.set $value2|18
       local.get $value1|17
       local.get $value2|18
       f64.min
       br $~lib/math/NativeMath.min|inlined.7
      end
      i32.trunc_sat_f64_u
      local.set $cxClamped
      local.get $cyClamped
      local.get $w
      i32.mul
      local.get $cxClamped
      i32.add
      i32.const 2
      i32.shl
      local.set $srcIdx
      local.get $dstPtr
      local.get $row
      i32.add
      local.get $x|14
      i32.const 2
      i32.shl
      i32.add
      local.get $srcPtr
      local.get $srcIdx
      i32.add
      i32.load
      i32.store
      local.get $x|14
      i32.const 1
      i32.add
      local.set $x|14
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/softglow (param $srcPtr i32) (param $w i32) (param $h i32) (param $amount f32) (param $startY i32) (param $endY i32)
  (local $y i32)
  (local $row i32)
  (local $x i32)
  (local $idx i32)
  (local $r f32)
  (local $g f32)
  (local $b f32)
  (local $luma f32)
  (local $factor f32)
  (local $val f32)
  (local $val|16 f32)
  (local $val|17 f32)
  (local $val|18 f32)
  (local $val|19 f32)
  (local $val|20 f32)
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $w
     i32.lt_s
     if
      local.get $row
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      local.set $idx
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.load8_u
      f32.convert_i32_u
      local.set $r
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 1
      i32.add
      i32.load8_u
      f32.convert_i32_u
      local.set $g
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 2
      i32.add
      i32.load8_u
      f32.convert_i32_u
      local.set $b
      f32.const 0.29899999499320984
      local.get $r
      f32.mul
      f32.const 0.5870000123977661
      local.get $g
      f32.mul
      f32.add
      f32.const 0.11400000005960464
      local.get $b
      f32.mul
      f32.add
      local.set $luma
      local.get $luma
      f32.const 128
      f32.gt
      if
       local.get $luma
       f32.const 128
       f32.sub
       f32.const 127
       f32.div
       local.get $amount
       f32.mul
       local.set $factor
       local.get $r
       local.get $r
       local.get $factor
       f32.mul
       f32.add
       local.set $r
       local.get $g
       local.get $g
       local.get $factor
       f32.mul
       f32.add
       local.set $g
       local.get $b
       local.get $b
       local.get $factor
       f32.mul
       f32.add
       local.set $b
      end
      local.get $srcPtr
      local.get $idx
      i32.add
      block $assembly/math/clamp255|inlined.25 (result i32)
       local.get $r
       local.set $val
       block $assembly/math/isNaN|inlined.34 (result i32)
        local.get $val
        local.set $val|16
        local.get $val|16
        local.get $val|16
        f32.ne
        br $assembly/math/isNaN|inlined.34
       end
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.25
       end
       local.get $val
       f32.const 0
       f32.lt
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.25
       end
       local.get $val
       f32.const 255
       f32.gt
       if
        i32.const 255
        br $assembly/math/clamp255|inlined.25
       end
       local.get $val
       i32.trunc_sat_f32_u
       br $assembly/math/clamp255|inlined.25
      end
      i32.store8
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 1
      i32.add
      block $assembly/math/clamp255|inlined.26 (result i32)
       local.get $g
       local.set $val|17
       block $assembly/math/isNaN|inlined.35 (result i32)
        local.get $val|17
        local.set $val|18
        local.get $val|18
        local.get $val|18
        f32.ne
        br $assembly/math/isNaN|inlined.35
       end
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.26
       end
       local.get $val|17
       f32.const 0
       f32.lt
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.26
       end
       local.get $val|17
       f32.const 255
       f32.gt
       if
        i32.const 255
        br $assembly/math/clamp255|inlined.26
       end
       local.get $val|17
       i32.trunc_sat_f32_u
       br $assembly/math/clamp255|inlined.26
      end
      i32.store8
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 2
      i32.add
      block $assembly/math/clamp255|inlined.27 (result i32)
       local.get $b
       local.set $val|19
       block $assembly/math/isNaN|inlined.36 (result i32)
        local.get $val|19
        local.set $val|20
        local.get $val|20
        local.get $val|20
        f32.ne
        br $assembly/math/isNaN|inlined.36
       end
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.27
       end
       local.get $val|19
       f32.const 0
       f32.lt
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.27
       end
       local.get $val|19
       f32.const 255
       f32.gt
       if
        i32.const 255
        br $assembly/math/clamp255|inlined.27
       end
       local.get $val|19
       i32.trunc_sat_f32_u
       br $assembly/math/clamp255|inlined.27
      end
      i32.store8
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/resize (param $srcPtr i32) (param $dstPtr i32) (param $sw i32) (param $sh i32) (param $dw i32) (param $dh i32)
  (local $xRatio f32)
  (local $yRatio f32)
  (local $y i32)
  (local $dRow i32)
  (local $py f32)
  (local $x i32)
  (local $px f32)
  (local $ptr i32)
  (local $w i32)
  (local $h i32)
  (local $x|16 f32)
  (local $y|17 f32)
  (local $val f32)
  (local $val|19 f32)
  (local $x|20 f64)
  (local $x0 i32)
  (local $x|22 f64)
  (local $y0 i32)
  (local $x1 i32)
  (local $y1 i32)
  (local $tx f32)
  (local $ty f32)
  (local $i00 i32)
  (local $i10 i32)
  (local $i01 i32)
  (local $i11 i32)
  (local $a f32)
  (local $b f32)
  (local $t f32)
  (local $a|35 f32)
  (local $b|36 f32)
  (local $t|37 f32)
  (local $a|38 f32)
  (local $b|39 f32)
  (local $t|40 f32)
  (local $r f32)
  (local $a|42 f32)
  (local $b|43 f32)
  (local $t|44 f32)
  (local $a|45 f32)
  (local $b|46 f32)
  (local $t|47 f32)
  (local $a|48 f32)
  (local $b|49 f32)
  (local $t|50 f32)
  (local $g f32)
  (local $a|52 f32)
  (local $b|53 f32)
  (local $t|54 f32)
  (local $a|55 f32)
  (local $b|56 f32)
  (local $t|57 f32)
  (local $a|58 f32)
  (local $b|59 f32)
  (local $t|60 f32)
  (local $b|61 f32)
  (local $a|62 f32)
  (local $b|63 f32)
  (local $t|64 f32)
  (local $a|65 f32)
  (local $b|66 f32)
  (local $t|67 f32)
  (local $a|68 f32)
  (local $b|69 f32)
  (local $t|70 f32)
  (local $a|71 f32)
  (local $val|72 f32)
  (local $val|73 f32)
  (local $val|74 f32)
  (local $val|75 f32)
  (local $val|76 f32)
  (local $val|77 f32)
  (local $val|78 f32)
  (local $val|79 f32)
  local.get $sw
  f32.convert_i32_s
  local.get $dw
  f32.convert_i32_s
  f32.div
  local.set $xRatio
  local.get $sh
  f32.convert_i32_s
  local.get $dh
  f32.convert_i32_s
  f32.div
  local.set $yRatio
  i32.const 0
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $dh
   i32.lt_s
   if
    local.get $y
    local.get $dw
    i32.mul
    i32.const 2
    i32.shl
    local.set $dRow
    local.get $y
    f32.convert_i32_s
    local.get $yRatio
    f32.mul
    local.set $py
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $dw
     i32.lt_s
     if
      local.get $x
      f32.convert_i32_s
      local.get $xRatio
      f32.mul
      local.set $px
      local.get $dstPtr
      local.get $dRow
      i32.add
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      block $assembly/math/sampleBilinear|inlined.3 (result i32)
       local.get $srcPtr
       local.set $ptr
       local.get $sw
       local.set $w
       local.get $sh
       local.set $h
       local.get $px
       local.set $x|16
       local.get $py
       local.set $y|17
       block $assembly/math/isNaN|inlined.37 (result i32)
        local.get $x|16
        local.set $val
        local.get $val
        local.get $val
        f32.ne
        br $assembly/math/isNaN|inlined.37
       end
       if (result i32)
        i32.const 1
       else
        block $assembly/math/isNaN|inlined.38 (result i32)
         local.get $y|17
         local.set $val|19
         local.get $val|19
         local.get $val|19
         f32.ne
         br $assembly/math/isNaN|inlined.38
        end
       end
       if
        i32.const 0
        br $assembly/math/sampleBilinear|inlined.3
       end
       local.get $x|16
       f32.const 0
       f32.lt
       if
        f32.const 0
        local.set $x|16
       end
       local.get $y|17
       f32.const 0
       f32.lt
       if
        f32.const 0
        local.set $y|17
       end
       local.get $x|16
       local.get $w
       f32.convert_i32_s
       f32.const 1
       f32.sub
       f32.ge
       if
        local.get $w
        f64.convert_i32_s
        f64.const 1.000001
        f64.sub
        f32.demote_f64
        local.set $x|16
       end
       local.get $y|17
       local.get $h
       f32.convert_i32_s
       f32.const 1
       f32.sub
       f32.ge
       if
        local.get $h
        f64.convert_i32_s
        f64.const 1.000001
        f64.sub
        f32.demote_f64
        local.set $y|17
       end
       block $~lib/math/NativeMath.floor|inlined.12 (result f64)
        local.get $x|16
        f64.promote_f32
        local.set $x|20
        local.get $x|20
        f64.floor
        br $~lib/math/NativeMath.floor|inlined.12
       end
       i32.trunc_sat_f64_s
       local.set $x0
       block $~lib/math/NativeMath.floor|inlined.13 (result f64)
        local.get $y|17
        f64.promote_f32
        local.set $x|22
        local.get $x|22
        f64.floor
        br $~lib/math/NativeMath.floor|inlined.13
       end
       i32.trunc_sat_f64_s
       local.set $y0
       local.get $x0
       i32.const 1
       i32.add
       local.set $x1
       local.get $y0
       i32.const 1
       i32.add
       local.set $y1
       local.get $x|16
       local.get $x0
       f32.convert_i32_s
       f32.sub
       local.set $tx
       local.get $y|17
       local.get $y0
       f32.convert_i32_s
       f32.sub
       local.set $ty
       local.get $y0
       local.get $w
       i32.mul
       local.get $x0
       i32.add
       i32.const 2
       i32.shl
       local.set $i00
       local.get $y0
       local.get $w
       i32.mul
       local.get $x1
       i32.add
       i32.const 2
       i32.shl
       local.set $i10
       local.get $y1
       local.get $w
       i32.mul
       local.get $x0
       i32.add
       i32.const 2
       i32.shl
       local.set $i01
       local.get $y1
       local.get $w
       i32.mul
       local.get $x1
       i32.add
       i32.const 2
       i32.shl
       local.set $i11
       block $assembly/math/lerp|inlined.38 (result f32)
        block $assembly/math/lerp|inlined.36 (result f32)
         local.get $ptr
         local.get $i00
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a
         local.get $ptr
         local.get $i10
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b
         local.get $tx
         local.set $t
         local.get $a
         local.get $b
         local.get $a
         f32.sub
         local.get $t
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.36
        end
        local.set $a|38
        block $assembly/math/lerp|inlined.37 (result f32)
         local.get $ptr
         local.get $i01
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|35
         local.get $ptr
         local.get $i11
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b|36
         local.get $tx
         local.set $t|37
         local.get $a|35
         local.get $b|36
         local.get $a|35
         f32.sub
         local.get $t|37
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.37
        end
        local.set $b|39
        local.get $ty
        local.set $t|40
        local.get $a|38
        local.get $b|39
        local.get $a|38
        f32.sub
        local.get $t|40
        f32.mul
        f32.add
        br $assembly/math/lerp|inlined.38
       end
       local.set $r
       block $assembly/math/lerp|inlined.41 (result f32)
        block $assembly/math/lerp|inlined.39 (result f32)
         local.get $ptr
         local.get $i00
         i32.add
         i32.const 1
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|42
         local.get $ptr
         local.get $i10
         i32.add
         i32.const 1
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b|43
         local.get $tx
         local.set $t|44
         local.get $a|42
         local.get $b|43
         local.get $a|42
         f32.sub
         local.get $t|44
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.39
        end
        local.set $a|48
        block $assembly/math/lerp|inlined.40 (result f32)
         local.get $ptr
         local.get $i01
         i32.add
         i32.const 1
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|45
         local.get $ptr
         local.get $i11
         i32.add
         i32.const 1
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b|46
         local.get $tx
         local.set $t|47
         local.get $a|45
         local.get $b|46
         local.get $a|45
         f32.sub
         local.get $t|47
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.40
        end
        local.set $b|49
        local.get $ty
        local.set $t|50
        local.get $a|48
        local.get $b|49
        local.get $a|48
        f32.sub
        local.get $t|50
        f32.mul
        f32.add
        br $assembly/math/lerp|inlined.41
       end
       local.set $g
       block $assembly/math/lerp|inlined.44 (result f32)
        block $assembly/math/lerp|inlined.42 (result f32)
         local.get $ptr
         local.get $i00
         i32.add
         i32.const 2
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|52
         local.get $ptr
         local.get $i10
         i32.add
         i32.const 2
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b|53
         local.get $tx
         local.set $t|54
         local.get $a|52
         local.get $b|53
         local.get $a|52
         f32.sub
         local.get $t|54
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.42
        end
        local.set $a|58
        block $assembly/math/lerp|inlined.43 (result f32)
         local.get $ptr
         local.get $i01
         i32.add
         i32.const 2
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|55
         local.get $ptr
         local.get $i11
         i32.add
         i32.const 2
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b|56
         local.get $tx
         local.set $t|57
         local.get $a|55
         local.get $b|56
         local.get $a|55
         f32.sub
         local.get $t|57
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.43
        end
        local.set $b|59
        local.get $ty
        local.set $t|60
        local.get $a|58
        local.get $b|59
        local.get $a|58
        f32.sub
        local.get $t|60
        f32.mul
        f32.add
        br $assembly/math/lerp|inlined.44
       end
       local.set $b|61
       block $assembly/math/lerp|inlined.47 (result f32)
        block $assembly/math/lerp|inlined.45 (result f32)
         local.get $ptr
         local.get $i00
         i32.add
         i32.const 3
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|62
         local.get $ptr
         local.get $i10
         i32.add
         i32.const 3
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b|63
         local.get $tx
         local.set $t|64
         local.get $a|62
         local.get $b|63
         local.get $a|62
         f32.sub
         local.get $t|64
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.45
        end
        local.set $a|68
        block $assembly/math/lerp|inlined.46 (result f32)
         local.get $ptr
         local.get $i01
         i32.add
         i32.const 3
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $a|65
         local.get $ptr
         local.get $i11
         i32.add
         i32.const 3
         i32.add
         i32.load8_u
         f32.convert_i32_u
         local.set $b|66
         local.get $tx
         local.set $t|67
         local.get $a|65
         local.get $b|66
         local.get $a|65
         f32.sub
         local.get $t|67
         f32.mul
         f32.add
         br $assembly/math/lerp|inlined.46
        end
        local.set $b|69
        local.get $ty
        local.set $t|70
        local.get $a|68
        local.get $b|69
        local.get $a|68
        f32.sub
        local.get $t|70
        f32.mul
        f32.add
        br $assembly/math/lerp|inlined.47
       end
       local.set $a|71
       block $assembly/math/clamp255|inlined.28 (result i32)
        local.get $r
        local.set $val|72
        block $assembly/math/isNaN|inlined.39 (result i32)
         local.get $val|72
         local.set $val|73
         local.get $val|73
         local.get $val|73
         f32.ne
         br $assembly/math/isNaN|inlined.39
        end
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.28
        end
        local.get $val|72
        f32.const 0
        f32.lt
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.28
        end
        local.get $val|72
        f32.const 255
        f32.gt
        if
         i32.const 255
         br $assembly/math/clamp255|inlined.28
        end
        local.get $val|72
        i32.trunc_sat_f32_u
        br $assembly/math/clamp255|inlined.28
       end
       i32.const 255
       i32.and
       block $assembly/math/clamp255|inlined.29 (result i32)
        local.get $g
        local.set $val|74
        block $assembly/math/isNaN|inlined.40 (result i32)
         local.get $val|74
         local.set $val|75
         local.get $val|75
         local.get $val|75
         f32.ne
         br $assembly/math/isNaN|inlined.40
        end
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.29
        end
        local.get $val|74
        f32.const 0
        f32.lt
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.29
        end
        local.get $val|74
        f32.const 255
        f32.gt
        if
         i32.const 255
         br $assembly/math/clamp255|inlined.29
        end
        local.get $val|74
        i32.trunc_sat_f32_u
        br $assembly/math/clamp255|inlined.29
       end
       i32.const 255
       i32.and
       i32.const 8
       i32.shl
       i32.or
       block $assembly/math/clamp255|inlined.30 (result i32)
        local.get $b|61
        local.set $val|76
        block $assembly/math/isNaN|inlined.41 (result i32)
         local.get $val|76
         local.set $val|77
         local.get $val|77
         local.get $val|77
         f32.ne
         br $assembly/math/isNaN|inlined.41
        end
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.30
        end
        local.get $val|76
        f32.const 0
        f32.lt
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.30
        end
        local.get $val|76
        f32.const 255
        f32.gt
        if
         i32.const 255
         br $assembly/math/clamp255|inlined.30
        end
        local.get $val|76
        i32.trunc_sat_f32_u
        br $assembly/math/clamp255|inlined.30
       end
       i32.const 255
       i32.and
       i32.const 16
       i32.shl
       i32.or
       block $assembly/math/clamp255|inlined.31 (result i32)
        local.get $a|71
        local.set $val|78
        block $assembly/math/isNaN|inlined.42 (result i32)
         local.get $val|78
         local.set $val|79
         local.get $val|79
         local.get $val|79
         f32.ne
         br $assembly/math/isNaN|inlined.42
        end
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.31
        end
        local.get $val|78
        f32.const 0
        f32.lt
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.31
        end
        local.get $val|78
        f32.const 255
        f32.gt
        if
         i32.const 255
         br $assembly/math/clamp255|inlined.31
        end
        local.get $val|78
        i32.trunc_sat_f32_u
        br $assembly/math/clamp255|inlined.31
       end
       i32.const 255
       i32.and
       i32.const 24
       i32.shl
       i32.or
       br $assembly/math/sampleBilinear|inlined.3
      end
      i32.store
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $~lib/array/Array<i32>#get:dataStart (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $assembly/filters/pixelate (param $srcPtr i32) (param $dstPtr i32) (param $w i32) (param $h i32) (param $size i32) (param $startY i32) (param $endY i32)
  (local $s i32)
  (local $y i32)
  (local $row i32)
  (local $py i32)
  (local $value1 f64)
  (local $value2 f64)
  (local $pyClamped i32)
  (local $x i32)
  (local $px i32)
  (local $value1|16 f64)
  (local $value2|17 f64)
  (local $pxClamped i32)
  (local $srcIdx i32)
  local.get $size
  i32.const 0
  i32.gt_s
  if (result i32)
   local.get $size
  else
   i32.const 1
  end
  local.set $s
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    local.get $y
    local.get $s
    i32.div_s
    local.get $s
    i32.mul
    local.set $py
    block $~lib/math/NativeMath.min|inlined.8 (result f64)
     local.get $h
     f64.convert_i32_s
     f64.const 1
     f64.sub
     local.set $value1
     local.get $py
     f64.convert_i32_s
     local.set $value2
     local.get $value1
     local.get $value2
     f64.min
     br $~lib/math/NativeMath.min|inlined.8
    end
    i32.trunc_sat_f64_u
    local.set $pyClamped
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $w
     i32.lt_s
     if
      local.get $x
      local.get $s
      i32.div_s
      local.get $s
      i32.mul
      local.set $px
      block $~lib/math/NativeMath.min|inlined.9 (result f64)
       local.get $w
       f64.convert_i32_s
       f64.const 1
       f64.sub
       local.set $value1|16
       local.get $px
       f64.convert_i32_s
       local.set $value2|17
       local.get $value1|16
       local.get $value2|17
       f64.min
       br $~lib/math/NativeMath.min|inlined.9
      end
      i32.trunc_sat_f64_u
      local.set $pxClamped
      local.get $pyClamped
      local.get $w
      i32.mul
      local.get $pxClamped
      i32.add
      i32.const 2
      i32.shl
      local.set $srcIdx
      local.get $dstPtr
      local.get $row
      i32.add
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      local.get $srcPtr
      local.get $srcIdx
      i32.add
      i32.load
      i32.store
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/sepia (param $srcPtr i32) (param $w i32) (param $h i32) (param $startY i32) (param $endY i32)
  (local $y i32)
  (local $row i32)
  (local $x i32)
  (local $idx i32)
  (local $r f32)
  (local $g f32)
  (local $b f32)
  (local $val f32)
  (local $val|13 f32)
  (local $val|14 f32)
  (local $val|15 f32)
  (local $val|16 f32)
  (local $val|17 f32)
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $w
     i32.lt_s
     if
      local.get $row
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      local.set $idx
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.load8_u
      f32.convert_i32_u
      local.set $r
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 1
      i32.add
      i32.load8_u
      f32.convert_i32_u
      local.set $g
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 2
      i32.add
      i32.load8_u
      f32.convert_i32_u
      local.set $b
      local.get $srcPtr
      local.get $idx
      i32.add
      block $assembly/math/clamp255|inlined.32 (result i32)
       local.get $r
       f32.const 0.3930000066757202
       f32.mul
       local.get $g
       f32.const 0.7689999938011169
       f32.mul
       f32.add
       local.get $b
       f32.const 0.1889999955892563
       f32.mul
       f32.add
       local.set $val
       block $assembly/math/isNaN|inlined.43 (result i32)
        local.get $val
        local.set $val|13
        local.get $val|13
        local.get $val|13
        f32.ne
        br $assembly/math/isNaN|inlined.43
       end
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.32
       end
       local.get $val
       f32.const 0
       f32.lt
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.32
       end
       local.get $val
       f32.const 255
       f32.gt
       if
        i32.const 255
        br $assembly/math/clamp255|inlined.32
       end
       local.get $val
       i32.trunc_sat_f32_u
       br $assembly/math/clamp255|inlined.32
      end
      i32.store8
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 1
      i32.add
      block $assembly/math/clamp255|inlined.33 (result i32)
       local.get $r
       f32.const 0.3490000069141388
       f32.mul
       local.get $g
       f32.const 0.6859999895095825
       f32.mul
       f32.add
       local.get $b
       f32.const 0.1679999977350235
       f32.mul
       f32.add
       local.set $val|14
       block $assembly/math/isNaN|inlined.44 (result i32)
        local.get $val|14
        local.set $val|15
        local.get $val|15
        local.get $val|15
        f32.ne
        br $assembly/math/isNaN|inlined.44
       end
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.33
       end
       local.get $val|14
       f32.const 0
       f32.lt
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.33
       end
       local.get $val|14
       f32.const 255
       f32.gt
       if
        i32.const 255
        br $assembly/math/clamp255|inlined.33
       end
       local.get $val|14
       i32.trunc_sat_f32_u
       br $assembly/math/clamp255|inlined.33
      end
      i32.store8
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 2
      i32.add
      block $assembly/math/clamp255|inlined.34 (result i32)
       local.get $r
       f32.const 0.2720000147819519
       f32.mul
       local.get $g
       f32.const 0.5339999794960022
       f32.mul
       f32.add
       local.get $b
       f32.const 0.13099999725818634
       f32.mul
       f32.add
       local.set $val|16
       block $assembly/math/isNaN|inlined.45 (result i32)
        local.get $val|16
        local.set $val|17
        local.get $val|17
        local.get $val|17
        f32.ne
        br $assembly/math/isNaN|inlined.45
       end
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.34
       end
       local.get $val|16
       f32.const 0
       f32.lt
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.34
       end
       local.get $val|16
       f32.const 255
       f32.gt
       if
        i32.const 255
        br $assembly/math/clamp255|inlined.34
       end
       local.get $val|16
       i32.trunc_sat_f32_u
       br $assembly/math/clamp255|inlined.34
      end
      i32.store8
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/exposure (param $srcPtr i32) (param $w i32) (param $h i32) (param $exp f32) (param $gamma f32) (param $startY i32) (param $endY i32)
  (local $invG f64)
  (local $y i32)
  (local $row i32)
  (local $x i32)
  (local $idx i32)
  (local $c i32)
  (local $v f32)
  (local $res f32)
  (local $val f32)
  (local $val|16 f32)
  local.get $gamma
  f32.const 0.05000000074505806
  f32.gt
  if (result f64)
   f64.const 1
   local.get $gamma
   f64.promote_f32
   f64.div
  else
   f64.const 1
  end
  local.set $invG
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $w
     i32.lt_s
     if
      local.get $row
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      local.set $idx
      i32.const 0
      local.set $c
      loop $for-loop|2
       local.get $c
       i32.const 3
       i32.lt_u
       if
        local.get $srcPtr
        local.get $idx
        i32.add
        local.get $c
        i32.add
        i32.load8_u
        f32.convert_i32_u
        local.get $exp
        f32.mul
        local.set $v
        local.get $v
        f64.promote_f32
        f64.const 255
        f64.div
        local.get $invG
        call $~lib/math/NativeMath.pow
        f64.const 255
        f64.mul
        f32.demote_f64
        local.set $res
        local.get $srcPtr
        local.get $idx
        i32.add
        local.get $c
        i32.add
        block $assembly/math/clamp255|inlined.35 (result i32)
         local.get $res
         local.set $val
         block $assembly/math/isNaN|inlined.46 (result i32)
          local.get $val
          local.set $val|16
          local.get $val|16
          local.get $val|16
          f32.ne
          br $assembly/math/isNaN|inlined.46
         end
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.35
         end
         local.get $val
         f32.const 0
         f32.lt
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.35
         end
         local.get $val
         f32.const 255
         f32.gt
         if
          i32.const 255
          br $assembly/math/clamp255|inlined.35
         end
         local.get $val
         i32.trunc_sat_f32_u
         br $assembly/math/clamp255|inlined.35
        end
        i32.store8
        local.get $c
        i32.const 1
        i32.add
        local.set $c
        br $for-loop|2
       end
      end
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/halftone (param $srcPtr i32) (param $w i32) (param $h i32) (param $dotSize f32) (param $startY i32) (param $endY i32)
  (local $freq f32)
  (local $cosA f32)
  (local $sinA f32)
  (local $y i32)
  (local $row i32)
  (local $x i32)
  (local $idx i32)
  (local $r i32)
  (local $g i32)
  (local $b i32)
  (local $luma f64)
  (local $rotX f32)
  (local $rotY f32)
  (local $pattern f32)
  (local $thresh f32)
  (local $v i32)
  f64.const 2
  global.get $~lib/math/NativeMath.PI
  f64.mul
  local.get $dotSize
  f64.promote_f32
  f64.div
  f32.demote_f64
  local.set $freq
  f32.const 0.7853981852531433
  f64.promote_f32
  call $~lib/math/NativeMath.cos
  f32.demote_f64
  local.set $cosA
  f32.const 0.7853981852531433
  f64.promote_f32
  call $~lib/math/NativeMath.sin
  f32.demote_f64
  local.set $sinA
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $w
     i32.lt_s
     if
      local.get $row
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      local.set $idx
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.load8_u
      local.set $r
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 1
      i32.add
      i32.load8_u
      local.set $g
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 2
      i32.add
      i32.load8_u
      local.set $b
      f64.const 0.299
      local.get $r
      f32.convert_i32_u
      f64.promote_f32
      f64.mul
      f64.const 0.587
      local.get $g
      f32.convert_i32_u
      f64.promote_f32
      f64.mul
      f64.add
      f64.const 0.114
      local.get $b
      f32.convert_i32_u
      f64.promote_f32
      f64.mul
      f64.add
      f64.const 255
      f64.div
      local.set $luma
      local.get $x
      f32.convert_i32_s
      local.get $cosA
      f32.mul
      local.get $y
      f32.convert_i32_s
      local.get $sinA
      f32.mul
      f32.sub
      local.set $rotX
      local.get $x
      f32.convert_i32_s
      local.get $sinA
      f32.mul
      local.get $y
      f32.convert_i32_s
      local.get $cosA
      f32.mul
      f32.add
      local.set $rotY
      local.get $rotX
      local.get $freq
      f32.mul
      f64.promote_f32
      call $~lib/math/NativeMath.sin
      local.get $rotY
      local.get $freq
      f32.mul
      f64.promote_f32
      call $~lib/math/NativeMath.sin
      f64.add
      f64.const 2
      f64.div
      f32.demote_f64
      local.set $pattern
      local.get $pattern
      f32.const 1
      f32.add
      f32.const 2
      f32.div
      local.set $thresh
      local.get $luma
      local.get $thresh
      f64.promote_f32
      f64.ge
      if (result i32)
       i32.const 255
      else
       i32.const 0
      end
      local.set $v
      local.get $srcPtr
      local.get $idx
      i32.add
      local.get $v
      i32.store8
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 1
      i32.add
      local.get $v
      i32.store8
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 2
      i32.add
      local.get $v
      i32.store8
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/edgeDetect (param $srcPtr i32) (param $dstPtr i32) (param $w i32) (param $h i32) (param $sensitivity f32) (param $startY i32) (param $endY i32)
  (local $y i32)
  (local $row i32)
  (local $x i32)
  (local $ptr i32)
  (local $w|11 i32)
  (local $px i32)
  (local $py i32)
  (local $idx i32)
  (local $ptr|15 i32)
  (local $w|16 i32)
  (local $px|17 i32)
  (local $py|18 i32)
  (local $idx|19 i32)
  (local $ptr|20 i32)
  (local $w|21 i32)
  (local $px|22 i32)
  (local $py|23 i32)
  (local $idx|24 i32)
  (local $ptr|25 i32)
  (local $w|26 i32)
  (local $px|27 i32)
  (local $py|28 i32)
  (local $idx|29 i32)
  (local $ptr|30 i32)
  (local $w|31 i32)
  (local $px|32 i32)
  (local $py|33 i32)
  (local $idx|34 i32)
  (local $ptr|35 i32)
  (local $w|36 i32)
  (local $px|37 i32)
  (local $py|38 i32)
  (local $idx|39 i32)
  (local $h_ f32)
  (local $ptr|41 i32)
  (local $w|42 i32)
  (local $px|43 i32)
  (local $py|44 i32)
  (local $idx|45 i32)
  (local $ptr|46 i32)
  (local $w|47 i32)
  (local $px|48 i32)
  (local $py|49 i32)
  (local $idx|50 i32)
  (local $ptr|51 i32)
  (local $w|52 i32)
  (local $px|53 i32)
  (local $py|54 i32)
  (local $idx|55 i32)
  (local $ptr|56 i32)
  (local $w|57 i32)
  (local $px|58 i32)
  (local $py|59 i32)
  (local $idx|60 i32)
  (local $ptr|61 i32)
  (local $w|62 i32)
  (local $px|63 i32)
  (local $py|64 i32)
  (local $idx|65 i32)
  (local $ptr|66 i32)
  (local $w|67 i32)
  (local $px|68 i32)
  (local $py|69 i32)
  (local $idx|70 i32)
  (local $v_ f32)
  (local $x|72 f64)
  (local $edge f32)
  (local $val f32)
  (local $val|75 f32)
  (local $v i32)
  (local $idx|77 i32)
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $w
     i32.lt_s
     if
      block $for-continue|1
       local.get $x
       i32.const 0
       i32.eq
       if (result i32)
        i32.const 1
       else
        local.get $x
        local.get $w
        i32.const 1
        i32.sub
        i32.eq
       end
       if (result i32)
        i32.const 1
       else
        local.get $y
        i32.const 0
        i32.eq
       end
       if (result i32)
        i32.const 1
       else
        local.get $y
        local.get $h
        i32.const 1
        i32.sub
        i32.eq
       end
       if
        local.get $dstPtr
        local.get $row
        i32.add
        local.get $x
        i32.const 2
        i32.shl
        i32.add
        i32.const 0
        i32.store
        br $for-continue|1
       end
       block $assembly/filters/getGray|inlined.0 (result f32)
        local.get $srcPtr
        local.set $ptr
        local.get $w
        local.set $w|11
        local.get $x
        i32.const 1
        i32.sub
        local.set $px
        local.get $y
        i32.const 1
        i32.sub
        local.set $py
        local.get $py
        local.get $w|11
        i32.mul
        local.get $px
        i32.add
        i32.const 2
        i32.shl
        local.set $idx
        f32.const 0.29899999499320984
        local.get $ptr
        local.get $idx
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.const 0.5870000123977661
        local.get $ptr
        local.get $idx
        i32.add
        i32.const 1
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        f32.const 0.11400000005960464
        local.get $ptr
        local.get $idx
        i32.add
        i32.const 2
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        br $assembly/filters/getGray|inlined.0
       end
       f32.const 2
       block $assembly/filters/getGray|inlined.1 (result f32)
        local.get $srcPtr
        local.set $ptr|15
        local.get $w
        local.set $w|16
        local.get $x
        i32.const 1
        i32.sub
        local.set $px|17
        local.get $y
        local.set $py|18
        local.get $py|18
        local.get $w|16
        i32.mul
        local.get $px|17
        i32.add
        i32.const 2
        i32.shl
        local.set $idx|19
        f32.const 0.29899999499320984
        local.get $ptr|15
        local.get $idx|19
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.const 0.5870000123977661
        local.get $ptr|15
        local.get $idx|19
        i32.add
        i32.const 1
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        f32.const 0.11400000005960464
        local.get $ptr|15
        local.get $idx|19
        i32.add
        i32.const 2
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        br $assembly/filters/getGray|inlined.1
       end
       f32.mul
       f32.add
       block $assembly/filters/getGray|inlined.2 (result f32)
        local.get $srcPtr
        local.set $ptr|20
        local.get $w
        local.set $w|21
        local.get $x
        i32.const 1
        i32.sub
        local.set $px|22
        local.get $y
        i32.const 1
        i32.add
        local.set $py|23
        local.get $py|23
        local.get $w|21
        i32.mul
        local.get $px|22
        i32.add
        i32.const 2
        i32.shl
        local.set $idx|24
        f32.const 0.29899999499320984
        local.get $ptr|20
        local.get $idx|24
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.const 0.5870000123977661
        local.get $ptr|20
        local.get $idx|24
        i32.add
        i32.const 1
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        f32.const 0.11400000005960464
        local.get $ptr|20
        local.get $idx|24
        i32.add
        i32.const 2
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        br $assembly/filters/getGray|inlined.2
       end
       f32.add
       block $assembly/filters/getGray|inlined.3 (result f32)
        local.get $srcPtr
        local.set $ptr|25
        local.get $w
        local.set $w|26
        local.get $x
        i32.const 1
        i32.add
        local.set $px|27
        local.get $y
        i32.const 1
        i32.sub
        local.set $py|28
        local.get $py|28
        local.get $w|26
        i32.mul
        local.get $px|27
        i32.add
        i32.const 2
        i32.shl
        local.set $idx|29
        f32.const 0.29899999499320984
        local.get $ptr|25
        local.get $idx|29
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.const 0.5870000123977661
        local.get $ptr|25
        local.get $idx|29
        i32.add
        i32.const 1
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        f32.const 0.11400000005960464
        local.get $ptr|25
        local.get $idx|29
        i32.add
        i32.const 2
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        br $assembly/filters/getGray|inlined.3
       end
       f32.const 2
       block $assembly/filters/getGray|inlined.4 (result f32)
        local.get $srcPtr
        local.set $ptr|30
        local.get $w
        local.set $w|31
        local.get $x
        i32.const 1
        i32.add
        local.set $px|32
        local.get $y
        local.set $py|33
        local.get $py|33
        local.get $w|31
        i32.mul
        local.get $px|32
        i32.add
        i32.const 2
        i32.shl
        local.set $idx|34
        f32.const 0.29899999499320984
        local.get $ptr|30
        local.get $idx|34
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.const 0.5870000123977661
        local.get $ptr|30
        local.get $idx|34
        i32.add
        i32.const 1
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        f32.const 0.11400000005960464
        local.get $ptr|30
        local.get $idx|34
        i32.add
        i32.const 2
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        br $assembly/filters/getGray|inlined.4
       end
       f32.mul
       f32.add
       block $assembly/filters/getGray|inlined.5 (result f32)
        local.get $srcPtr
        local.set $ptr|35
        local.get $w
        local.set $w|36
        local.get $x
        i32.const 1
        i32.add
        local.set $px|37
        local.get $y
        i32.const 1
        i32.add
        local.set $py|38
        local.get $py|38
        local.get $w|36
        i32.mul
        local.get $px|37
        i32.add
        i32.const 2
        i32.shl
        local.set $idx|39
        f32.const 0.29899999499320984
        local.get $ptr|35
        local.get $idx|39
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.const 0.5870000123977661
        local.get $ptr|35
        local.get $idx|39
        i32.add
        i32.const 1
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        f32.const 0.11400000005960464
        local.get $ptr|35
        local.get $idx|39
        i32.add
        i32.const 2
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        br $assembly/filters/getGray|inlined.5
       end
       f32.add
       f32.sub
       local.set $h_
       block $assembly/filters/getGray|inlined.6 (result f32)
        local.get $srcPtr
        local.set $ptr|41
        local.get $w
        local.set $w|42
        local.get $x
        i32.const 1
        i32.sub
        local.set $px|43
        local.get $y
        i32.const 1
        i32.sub
        local.set $py|44
        local.get $py|44
        local.get $w|42
        i32.mul
        local.get $px|43
        i32.add
        i32.const 2
        i32.shl
        local.set $idx|45
        f32.const 0.29899999499320984
        local.get $ptr|41
        local.get $idx|45
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.const 0.5870000123977661
        local.get $ptr|41
        local.get $idx|45
        i32.add
        i32.const 1
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        f32.const 0.11400000005960464
        local.get $ptr|41
        local.get $idx|45
        i32.add
        i32.const 2
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        br $assembly/filters/getGray|inlined.6
       end
       f32.const 2
       block $assembly/filters/getGray|inlined.7 (result f32)
        local.get $srcPtr
        local.set $ptr|46
        local.get $w
        local.set $w|47
        local.get $x
        local.set $px|48
        local.get $y
        i32.const 1
        i32.sub
        local.set $py|49
        local.get $py|49
        local.get $w|47
        i32.mul
        local.get $px|48
        i32.add
        i32.const 2
        i32.shl
        local.set $idx|50
        f32.const 0.29899999499320984
        local.get $ptr|46
        local.get $idx|50
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.const 0.5870000123977661
        local.get $ptr|46
        local.get $idx|50
        i32.add
        i32.const 1
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        f32.const 0.11400000005960464
        local.get $ptr|46
        local.get $idx|50
        i32.add
        i32.const 2
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        br $assembly/filters/getGray|inlined.7
       end
       f32.mul
       f32.add
       block $assembly/filters/getGray|inlined.8 (result f32)
        local.get $srcPtr
        local.set $ptr|51
        local.get $w
        local.set $w|52
        local.get $x
        i32.const 1
        i32.add
        local.set $px|53
        local.get $y
        i32.const 1
        i32.sub
        local.set $py|54
        local.get $py|54
        local.get $w|52
        i32.mul
        local.get $px|53
        i32.add
        i32.const 2
        i32.shl
        local.set $idx|55
        f32.const 0.29899999499320984
        local.get $ptr|51
        local.get $idx|55
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.const 0.5870000123977661
        local.get $ptr|51
        local.get $idx|55
        i32.add
        i32.const 1
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        f32.const 0.11400000005960464
        local.get $ptr|51
        local.get $idx|55
        i32.add
        i32.const 2
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        br $assembly/filters/getGray|inlined.8
       end
       f32.add
       block $assembly/filters/getGray|inlined.9 (result f32)
        local.get $srcPtr
        local.set $ptr|56
        local.get $w
        local.set $w|57
        local.get $x
        i32.const 1
        i32.sub
        local.set $px|58
        local.get $y
        i32.const 1
        i32.add
        local.set $py|59
        local.get $py|59
        local.get $w|57
        i32.mul
        local.get $px|58
        i32.add
        i32.const 2
        i32.shl
        local.set $idx|60
        f32.const 0.29899999499320984
        local.get $ptr|56
        local.get $idx|60
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.const 0.5870000123977661
        local.get $ptr|56
        local.get $idx|60
        i32.add
        i32.const 1
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        f32.const 0.11400000005960464
        local.get $ptr|56
        local.get $idx|60
        i32.add
        i32.const 2
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        br $assembly/filters/getGray|inlined.9
       end
       f32.const 2
       block $assembly/filters/getGray|inlined.10 (result f32)
        local.get $srcPtr
        local.set $ptr|61
        local.get $w
        local.set $w|62
        local.get $x
        local.set $px|63
        local.get $y
        i32.const 1
        i32.add
        local.set $py|64
        local.get $py|64
        local.get $w|62
        i32.mul
        local.get $px|63
        i32.add
        i32.const 2
        i32.shl
        local.set $idx|65
        f32.const 0.29899999499320984
        local.get $ptr|61
        local.get $idx|65
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.const 0.5870000123977661
        local.get $ptr|61
        local.get $idx|65
        i32.add
        i32.const 1
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        f32.const 0.11400000005960464
        local.get $ptr|61
        local.get $idx|65
        i32.add
        i32.const 2
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        br $assembly/filters/getGray|inlined.10
       end
       f32.mul
       f32.add
       block $assembly/filters/getGray|inlined.11 (result f32)
        local.get $srcPtr
        local.set $ptr|66
        local.get $w
        local.set $w|67
        local.get $x
        i32.const 1
        i32.add
        local.set $px|68
        local.get $y
        i32.const 1
        i32.add
        local.set $py|69
        local.get $py|69
        local.get $w|67
        i32.mul
        local.get $px|68
        i32.add
        i32.const 2
        i32.shl
        local.set $idx|70
        f32.const 0.29899999499320984
        local.get $ptr|66
        local.get $idx|70
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.const 0.5870000123977661
        local.get $ptr|66
        local.get $idx|70
        i32.add
        i32.const 1
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        f32.const 0.11400000005960464
        local.get $ptr|66
        local.get $idx|70
        i32.add
        i32.const 2
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.mul
        f32.add
        br $assembly/filters/getGray|inlined.11
       end
       f32.add
       f32.sub
       local.set $v_
       block $~lib/math/NativeMath.sqrt|inlined.6 (result f64)
        local.get $h_
        local.get $h_
        f32.mul
        local.get $v_
        local.get $v_
        f32.mul
        f32.add
        f64.promote_f32
        local.set $x|72
        local.get $x|72
        f64.sqrt
        br $~lib/math/NativeMath.sqrt|inlined.6
       end
       f32.demote_f64
       local.set $edge
       block $assembly/math/clamp255|inlined.36 (result i32)
        local.get $edge
        local.get $sensitivity
        f32.mul
        f32.const 4
        f32.mul
        local.set $val
        block $assembly/math/isNaN|inlined.47 (result i32)
         local.get $val
         local.set $val|75
         local.get $val|75
         local.get $val|75
         f32.ne
         br $assembly/math/isNaN|inlined.47
        end
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.36
        end
        local.get $val
        f32.const 0
        f32.lt
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.36
        end
        local.get $val
        f32.const 255
        f32.gt
        if
         i32.const 255
         br $assembly/math/clamp255|inlined.36
        end
        local.get $val
        i32.trunc_sat_f32_u
        br $assembly/math/clamp255|inlined.36
       end
       local.set $v
       local.get $row
       local.get $x
       i32.const 2
       i32.shl
       i32.add
       local.set $idx|77
       local.get $dstPtr
       local.get $idx|77
       i32.add
       local.get $v
       i32.store8
       local.get $dstPtr
       local.get $idx|77
       i32.add
       i32.const 1
       i32.add
       local.get $v
       i32.store8
       local.get $dstPtr
       local.get $idx|77
       i32.add
       i32.const 2
       i32.add
       local.get $v
       i32.store8
       local.get $dstPtr
       local.get $idx|77
       i32.add
       i32.const 3
       i32.add
       local.get $srcPtr
       local.get $idx|77
       i32.add
       i32.const 3
       i32.add
       i32.load8_u
       i32.store8
      end
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/scanlines (param $srcPtr i32) (param $w i32) (param $h i32) (param $density f32) (param $opacity f32) (param $startY i32) (param $endY i32)
  (local $y i32)
  (local $row i32)
  (local $line f32)
  (local $factor f32)
  (local $x i32)
  (local $idx i32)
  (local $val f32)
  (local $val|14 f32)
  (local $val|15 f32)
  (local $val|16 f32)
  (local $val|17 f32)
  (local $val|18 f32)
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    local.get $y
    f64.convert_i32_s
    local.get $density
    f64.promote_f32
    f64.mul
    call $~lib/math/NativeMath.sin
    f32.demote_f64
    local.set $line
    f32.const 1
    local.get $line
    f32.const 0
    f32.lt
    if (result f32)
     local.get $line
     f32.neg
    else
     local.get $line
    end
    local.get $opacity
    f32.mul
    f32.sub
    local.set $factor
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $w
     i32.lt_s
     if
      local.get $row
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      local.set $idx
      local.get $srcPtr
      local.get $idx
      i32.add
      block $assembly/math/clamp255|inlined.37 (result i32)
       local.get $srcPtr
       local.get $idx
       i32.add
       i32.load8_u
       f32.convert_i32_u
       local.get $factor
       f32.mul
       local.set $val
       block $assembly/math/isNaN|inlined.48 (result i32)
        local.get $val
        local.set $val|14
        local.get $val|14
        local.get $val|14
        f32.ne
        br $assembly/math/isNaN|inlined.48
       end
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.37
       end
       local.get $val
       f32.const 0
       f32.lt
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.37
       end
       local.get $val
       f32.const 255
       f32.gt
       if
        i32.const 255
        br $assembly/math/clamp255|inlined.37
       end
       local.get $val
       i32.trunc_sat_f32_u
       br $assembly/math/clamp255|inlined.37
      end
      i32.store8
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 1
      i32.add
      block $assembly/math/clamp255|inlined.38 (result i32)
       local.get $srcPtr
       local.get $idx
       i32.add
       i32.const 1
       i32.add
       i32.load8_u
       f32.convert_i32_u
       local.get $factor
       f32.mul
       local.set $val|15
       block $assembly/math/isNaN|inlined.49 (result i32)
        local.get $val|15
        local.set $val|16
        local.get $val|16
        local.get $val|16
        f32.ne
        br $assembly/math/isNaN|inlined.49
       end
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.38
       end
       local.get $val|15
       f32.const 0
       f32.lt
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.38
       end
       local.get $val|15
       f32.const 255
       f32.gt
       if
        i32.const 255
        br $assembly/math/clamp255|inlined.38
       end
       local.get $val|15
       i32.trunc_sat_f32_u
       br $assembly/math/clamp255|inlined.38
      end
      i32.store8
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 2
      i32.add
      block $assembly/math/clamp255|inlined.39 (result i32)
       local.get $srcPtr
       local.get $idx
       i32.add
       i32.const 2
       i32.add
       i32.load8_u
       f32.convert_i32_u
       local.get $factor
       f32.mul
       local.set $val|17
       block $assembly/math/isNaN|inlined.50 (result i32)
        local.get $val|17
        local.set $val|18
        local.get $val|18
        local.get $val|18
        f32.ne
        br $assembly/math/isNaN|inlined.50
       end
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.39
       end
       local.get $val|17
       f32.const 0
       f32.lt
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.39
       end
       local.get $val|17
       f32.const 255
       f32.gt
       if
        i32.const 255
        br $assembly/math/clamp255|inlined.39
       end
       local.get $val|17
       i32.trunc_sat_f32_u
       br $assembly/math/clamp255|inlined.39
      end
      i32.store8
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/blendMask (param $basePtr i32) (param $filteredPtr i32) (param $maskPtr i32) (param $outPtr i32) (param $w i32) (param $h i32) (param $startY i32) (param $endY i32)
  (local $y i32)
  (local $row i32)
  (local $x i32)
  (local $idx i32)
  (local $m f32)
  (local $om f32)
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $w
     i32.lt_s
     if
      local.get $row
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      local.set $idx
      local.get $maskPtr
      local.get $idx
      i32.add
      i32.const 3
      i32.add
      i32.load8_u
      f32.convert_i32_u
      f32.const 0.003921568859368563
      f32.mul
      local.set $m
      f32.const 1
      local.get $m
      f32.sub
      local.set $om
      local.get $outPtr
      local.get $idx
      i32.add
      local.get $basePtr
      local.get $idx
      i32.add
      i32.load8_u
      f32.convert_i32_u
      local.get $om
      f32.mul
      local.get $filteredPtr
      local.get $idx
      i32.add
      i32.load8_u
      f32.convert_i32_u
      local.get $m
      f32.mul
      f32.add
      f32.const 0.5
      f32.add
      i32.trunc_sat_f32_u
      i32.store8
      local.get $outPtr
      local.get $idx
      i32.add
      i32.const 1
      i32.add
      local.get $basePtr
      local.get $idx
      i32.add
      i32.const 1
      i32.add
      i32.load8_u
      f32.convert_i32_u
      local.get $om
      f32.mul
      local.get $filteredPtr
      local.get $idx
      i32.add
      i32.const 1
      i32.add
      i32.load8_u
      f32.convert_i32_u
      local.get $m
      f32.mul
      f32.add
      f32.const 0.5
      f32.add
      i32.trunc_sat_f32_u
      i32.store8
      local.get $outPtr
      local.get $idx
      i32.add
      i32.const 2
      i32.add
      local.get $basePtr
      local.get $idx
      i32.add
      i32.const 2
      i32.add
      i32.load8_u
      f32.convert_i32_u
      local.get $om
      f32.mul
      local.get $filteredPtr
      local.get $idx
      i32.add
      i32.const 2
      i32.add
      i32.load8_u
      f32.convert_i32_u
      local.get $m
      f32.mul
      f32.add
      f32.const 0.5
      f32.add
      i32.trunc_sat_f32_u
      i32.store8
      local.get $outPtr
      local.get $idx
      i32.add
      i32.const 3
      i32.add
      local.get $basePtr
      local.get $idx
      i32.add
      i32.const 3
      i32.add
      i32.load8_u
      i32.store8
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/buildDynamicMask (param $layerPtr i32) (param $maskPtr i32) (param $lw i32) (param $lh i32) (param $lx i32) (param $ly i32) (param $dw i32) (param $dh i32) (param $opacity f32)
  (local $py i32)
  (local $row i32)
  (local $lpy i32)
  (local $px i32)
  (local $lpx i32)
  (local $idx i32)
  (local $lIdx i32)
  (local $r f32)
  (local $g f32)
  (local $b f32)
  (local $a f32)
  (local $lum f64)
  (local $val f32)
  (local $val|22 f32)
  (local $val|23 i32)
  i32.const 0
  local.set $py
  loop $for-loop|0
   local.get $py
   local.get $dh
   i32.lt_s
   if
    local.get $py
    local.get $dw
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    local.get $py
    local.get $ly
    i32.sub
    local.set $lpy
    i32.const 0
    local.set $px
    loop $for-loop|1
     local.get $px
     local.get $dw
     i32.lt_s
     if
      block $for-continue|1
       local.get $px
       local.get $lx
       i32.sub
       local.set $lpx
       local.get $row
       local.get $px
       i32.const 2
       i32.shl
       i32.add
       local.set $idx
       local.get $lpx
       i32.const 0
       i32.lt_s
       if (result i32)
        i32.const 1
       else
        local.get $lpy
        i32.const 0
        i32.lt_s
       end
       if (result i32)
        i32.const 1
       else
        local.get $lpx
        local.get $lw
        i32.ge_s
       end
       if (result i32)
        i32.const 1
       else
        local.get $lpy
        local.get $lh
        i32.ge_s
       end
       if
        local.get $maskPtr
        local.get $idx
        i32.add
        i32.const 0
        i32.store
        br $for-continue|1
       end
       local.get $lpy
       local.get $lw
       i32.mul
       local.get $lpx
       i32.add
       i32.const 2
       i32.shl
       local.set $lIdx
       local.get $layerPtr
       local.get $lIdx
       i32.add
       i32.load8_u
       f32.convert_i32_u
       local.set $r
       local.get $layerPtr
       local.get $lIdx
       i32.add
       i32.const 1
       i32.add
       i32.load8_u
       f32.convert_i32_u
       local.set $g
       local.get $layerPtr
       local.get $lIdx
       i32.add
       i32.const 2
       i32.add
       i32.load8_u
       f32.convert_i32_u
       local.set $b
       local.get $layerPtr
       local.get $lIdx
       i32.add
       i32.const 3
       i32.add
       i32.load8_u
       f32.convert_i32_u
       f32.const 255
       f32.div
       local.set $a
       f64.const 0.299
       local.get $r
       f64.promote_f32
       f64.mul
       f64.const 0.587
       local.get $g
       f64.promote_f32
       f64.mul
       f64.add
       f64.const 0.114
       local.get $b
       f64.promote_f32
       f64.mul
       f64.add
       f64.const 255
       f64.div
       local.set $lum
       block $assembly/math/clamp255|inlined.40 (result i32)
        local.get $lum
        local.get $a
        f64.promote_f32
        f64.mul
        local.get $opacity
        f64.promote_f32
        f64.mul
        f64.const 255
        f64.mul
        f32.demote_f64
        local.set $val
        block $assembly/math/isNaN|inlined.51 (result i32)
         local.get $val
         local.set $val|22
         local.get $val|22
         local.get $val|22
         f32.ne
         br $assembly/math/isNaN|inlined.51
        end
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.40
        end
        local.get $val
        f32.const 0
        f32.lt
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.40
        end
        local.get $val
        f32.const 255
        f32.gt
        if
         i32.const 255
         br $assembly/math/clamp255|inlined.40
        end
        local.get $val
        i32.trunc_sat_f32_u
        br $assembly/math/clamp255|inlined.40
       end
       local.set $val|23
       local.get $maskPtr
       local.get $idx
       i32.add
       i32.const 0
       i32.store8
       local.get $maskPtr
       local.get $idx
       i32.add
       i32.const 1
       i32.add
       i32.const 0
       i32.store8
       local.get $maskPtr
       local.get $idx
       i32.add
       i32.const 2
       i32.add
       i32.const 0
       i32.store8
       local.get $maskPtr
       local.get $idx
       i32.add
       i32.const 3
       i32.add
       local.get $val|23
       i32.store8
      end
      local.get $px
      i32.const 1
      i32.add
      local.set $px
      br $for-loop|1
     end
    end
    local.get $py
    i32.const 1
    i32.add
    local.set $py
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/applyLuminanceMask (param $layerPtr i32) (param $maskPtr i32) (param $outPtr i32) (param $lw i32) (param $lh i32) (param $lx i32) (param $ly i32) (param $mw i32) (param $mh i32) (param $dw i32) (param $dh i32)
  (local $py i32)
  (local $row i32)
  (local $lpy i32)
  (local $px i32)
  (local $lpx i32)
  (local $idx i32)
  (local $lIdx i32)
  (local $alpha f32)
  (local $k i32)
  (local $r f32)
  (local $g f32)
  (local $b f32)
  (local $a f32)
  (local $lum f64)
  i32.const 0
  local.set $py
  loop $for-loop|0
   local.get $py
   local.get $dh
   i32.lt_s
   if
    local.get $py
    local.get $dw
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    local.get $py
    local.get $ly
    i32.sub
    local.set $lpy
    i32.const 0
    local.set $px
    loop $for-loop|1
     local.get $px
     local.get $dw
     i32.lt_s
     if
      block $for-continue|1
       local.get $px
       local.get $lx
       i32.sub
       local.set $lpx
       local.get $row
       local.get $px
       i32.const 2
       i32.shl
       i32.add
       local.set $idx
       local.get $lpx
       i32.const 0
       i32.lt_s
       if (result i32)
        i32.const 1
       else
        local.get $lpy
        i32.const 0
        i32.lt_s
       end
       if (result i32)
        i32.const 1
       else
        local.get $lpx
        local.get $lw
        i32.ge_s
       end
       if (result i32)
        i32.const 1
       else
        local.get $lpy
        local.get $lh
        i32.ge_s
       end
       if
        local.get $outPtr
        local.get $idx
        i32.add
        i32.const 0
        i32.store
        br $for-continue|1
       end
       local.get $lpy
       local.get $lw
       i32.mul
       local.get $lpx
       i32.add
       i32.const 2
       i32.shl
       local.set $lIdx
       local.get $layerPtr
       local.get $lIdx
       i32.add
       i32.const 3
       i32.add
       i32.load8_u
       f32.convert_i32_u
       local.set $alpha
       local.get $lpx
       local.get $mw
       i32.lt_s
       if (result i32)
        local.get $lpy
        local.get $mh
        i32.lt_s
       else
        i32.const 0
       end
       if
        local.get $lpy
        local.get $mw
        i32.mul
        local.get $lpx
        i32.add
        i32.const 2
        i32.shl
        local.set $k
        local.get $maskPtr
        local.get $k
        i32.add
        i32.load8_u
        f32.convert_i32_u
        local.set $r
        local.get $maskPtr
        local.get $k
        i32.add
        i32.const 1
        i32.add
        i32.load8_u
        f32.convert_i32_u
        local.set $g
        local.get $maskPtr
        local.get $k
        i32.add
        i32.const 2
        i32.add
        i32.load8_u
        f32.convert_i32_u
        local.set $b
        local.get $maskPtr
        local.get $k
        i32.add
        i32.const 3
        i32.add
        i32.load8_u
        f32.convert_i32_u
        f32.const 255
        f32.div
        local.set $a
        f64.const 0.299
        local.get $r
        f64.promote_f32
        f64.mul
        f64.const 0.587
        local.get $g
        f64.promote_f32
        f64.mul
        f64.add
        f64.const 0.114
        local.get $b
        f64.promote_f32
        f64.mul
        f64.add
        f64.const 255
        f64.div
        local.get $a
        f64.promote_f32
        f64.mul
        local.set $lum
        local.get $alpha
        local.get $lum
        f32.demote_f64
        f32.mul
        local.set $alpha
       end
       local.get $outPtr
       local.get $idx
       i32.add
       local.get $layerPtr
       local.get $lIdx
       i32.add
       i32.load8_u
       i32.store8
       local.get $outPtr
       local.get $idx
       i32.add
       i32.const 1
       i32.add
       local.get $layerPtr
       local.get $lIdx
       i32.add
       i32.const 1
       i32.add
       i32.load8_u
       i32.store8
       local.get $outPtr
       local.get $idx
       i32.add
       i32.const 2
       i32.add
       local.get $layerPtr
       local.get $lIdx
       i32.add
       i32.const 2
       i32.add
       i32.load8_u
       i32.store8
       local.get $outPtr
       local.get $idx
       i32.add
       i32.const 3
       i32.add
       local.get $alpha
       f32.const 0.5
       f32.add
       i32.trunc_sat_f32_u
       i32.store8
      end
      local.get $px
      i32.const 1
      i32.add
      local.set $px
      br $for-loop|1
     end
    end
    local.get $py
    i32.const 1
    i32.add
    local.set $py
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/similarColor (param $dataPtr i32) (param $maskPtr i32) (param $w i32) (param $h i32) (param $sr i32) (param $sg i32) (param $sb i32) (param $sa i32) (param $tol f32)
  (local $tolSq f32)
  (local $i i32)
  (local $idx i32)
  (local $dr f32)
  (local $dg f32)
  (local $db f32)
  (local $da f32)
  local.get $tol
  local.get $tol
  f32.mul
  local.set $tolSq
  i32.const 0
  local.set $i
  loop $for-loop|0
   local.get $i
   local.get $w
   local.get $h
   i32.mul
   i32.lt_s
   if
    local.get $i
    i32.const 2
    i32.shl
    local.set $idx
    local.get $dataPtr
    local.get $idx
    i32.add
    i32.load8_u
    f32.convert_i32_u
    local.get $sr
    i32.const 255
    i32.and
    f32.convert_i32_u
    f32.sub
    local.set $dr
    local.get $dataPtr
    local.get $idx
    i32.add
    i32.const 1
    i32.add
    i32.load8_u
    f32.convert_i32_u
    local.get $sg
    i32.const 255
    i32.and
    f32.convert_i32_u
    f32.sub
    local.set $dg
    local.get $dataPtr
    local.get $idx
    i32.add
    i32.const 2
    i32.add
    i32.load8_u
    f32.convert_i32_u
    local.get $sb
    i32.const 255
    i32.and
    f32.convert_i32_u
    f32.sub
    local.set $db
    local.get $dataPtr
    local.get $idx
    i32.add
    i32.const 3
    i32.add
    i32.load8_u
    f32.convert_i32_u
    local.get $sa
    i32.const 255
    i32.and
    f32.convert_i32_u
    f32.sub
    local.set $da
    local.get $dr
    local.get $dr
    f32.mul
    local.get $dg
    local.get $dg
    f32.mul
    f32.add
    local.get $db
    local.get $db
    f32.mul
    f32.add
    local.get $da
    local.get $da
    f32.mul
    f32.add
    local.get $tolSq
    f32.le
    if
     local.get $maskPtr
     local.get $i
     i32.add
     i32.const 1
     i32.store8
    else
     local.get $maskPtr
     local.get $i
     i32.add
     i32.const 0
     i32.store8
    end
    local.get $i
    i32.const 1
    i32.add
    local.set $i
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/colorMatch (param $dataPtr i32) (param $maskPtr i32) (param $w i32) (param $h i32) (param $r0 i32) (param $g0 i32) (param $b0 i32) (param $a0 i32) (param $rgbMax f32) (param $alphaMax f32)
  (local $rgbMaxSq f32)
  (local $i i32)
  (local $idx i32)
  (local $dr f32)
  (local $dg f32)
  (local $db f32)
  (local $x f64)
  (local $da f32)
  (local $distRgbSq f32)
  local.get $rgbMax
  local.get $rgbMax
  f32.mul
  local.set $rgbMaxSq
  i32.const 0
  local.set $i
  loop $for-loop|0
   local.get $i
   local.get $w
   local.get $h
   i32.mul
   i32.lt_s
   if
    local.get $i
    i32.const 2
    i32.shl
    local.set $idx
    local.get $dataPtr
    local.get $idx
    i32.add
    i32.load8_u
    f32.convert_i32_u
    local.get $r0
    i32.const 255
    i32.and
    f32.convert_i32_u
    f32.sub
    local.set $dr
    local.get $dataPtr
    local.get $idx
    i32.add
    i32.const 1
    i32.add
    i32.load8_u
    f32.convert_i32_u
    local.get $g0
    i32.const 255
    i32.and
    f32.convert_i32_u
    f32.sub
    local.set $dg
    local.get $dataPtr
    local.get $idx
    i32.add
    i32.const 2
    i32.add
    i32.load8_u
    f32.convert_i32_u
    local.get $b0
    i32.const 255
    i32.and
    f32.convert_i32_u
    f32.sub
    local.set $db
    block $~lib/math/NativeMath.abs|inlined.0 (result f64)
     local.get $dataPtr
     local.get $idx
     i32.add
     i32.const 3
     i32.add
     i32.load8_u
     f64.convert_i32_u
     local.get $a0
     i32.const 255
     i32.and
     f64.convert_i32_u
     f64.sub
     local.set $x
     local.get $x
     f64.abs
     br $~lib/math/NativeMath.abs|inlined.0
    end
    f32.demote_f64
    local.set $da
    local.get $dr
    local.get $dr
    f32.mul
    local.get $dg
    local.get $dg
    f32.mul
    f32.add
    local.get $db
    local.get $db
    f32.mul
    f32.add
    local.set $distRgbSq
    local.get $distRgbSq
    local.get $rgbMaxSq
    f32.le
    if (result i32)
     local.get $da
     local.get $alphaMax
     f32.le
    else
     i32.const 0
    end
    if
     local.get $maskPtr
     local.get $i
     i32.add
     i32.const 1
     i32.store8
    else
     local.get $maskPtr
     local.get $i
     i32.add
     i32.const 0
     i32.store8
    end
    local.get $i
    i32.const 1
    i32.add
    local.set $i
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/grayscaleAlpha (param $srcPtr i32) (param $dstPtr i32) (param $w i32) (param $h i32)
  (local $i i32)
  (local $idx i32)
  (local $a i32)
  i32.const 0
  local.set $i
  loop $for-loop|0
   local.get $i
   local.get $w
   local.get $h
   i32.mul
   i32.lt_u
   if
    local.get $i
    i32.const 2
    i32.shl
    local.set $idx
    local.get $srcPtr
    local.get $idx
    i32.add
    i32.const 3
    i32.add
    i32.load8_u
    local.set $a
    local.get $dstPtr
    local.get $idx
    i32.add
    local.get $a
    i32.store8
    local.get $dstPtr
    local.get $idx
    i32.add
    i32.const 1
    i32.add
    local.get $a
    i32.store8
    local.get $dstPtr
    local.get $idx
    i32.add
    i32.const 2
    i32.add
    local.get $a
    i32.store8
    local.get $dstPtr
    local.get $idx
    i32.add
    i32.const 3
    i32.add
    i32.const 255
    i32.store8
    local.get $i
    i32.const 1
    i32.add
    local.set $i
    br $for-loop|0
   end
  end
 )
 (func $assembly/filters/getMaskOutlineSegments (param $maskPtr i32) (param $w i32) (param $h i32) (param $startX i32) (param $startY i32) (param $endX i32) (param $endY i32) (param $stride i32) (param $outPtr i32) (param $maxSegments i32) (result i32)
  (local $count i32)
  (local $y i32)
  (local $rowOffset i32)
  (local $x i32)
  (local $valCurrent i32)
  (local $valPrev i32)
  (local $offset i32)
  (local $y|17 i32)
  (local $rowOffset|18 i32)
  (local $prevRowOffset i32)
  (local $x|20 i32)
  (local $valCurrent|21 i32)
  (local $valPrev|22 i32)
  (local $offset|23 i32)
  i32.const 0
  local.set $count
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    local.set $rowOffset
    local.get $startX
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $endX
     i32.le_s
     if
      local.get $x
      local.get $w
      i32.lt_s
      if (result i32)
       local.get $maskPtr
       local.get $rowOffset
       i32.add
       local.get $x
       i32.add
       i32.load8_u
      else
       i32.const 0
      end
      local.set $valCurrent
      local.get $x
      local.get $stride
      i32.ge_s
      if (result i32)
       local.get $maskPtr
       local.get $rowOffset
       i32.add
       local.get $x
       local.get $stride
       i32.sub
       i32.add
       i32.load8_u
      else
       i32.const 0
      end
      local.set $valPrev
      local.get $valCurrent
      local.get $valPrev
      i32.ne
      if
       local.get $count
       local.get $maxSegments
       i32.ge_s
       if
        local.get $count
        return
       end
       local.get $count
       i32.const 4
       i32.shl
       local.set $offset
       local.get $outPtr
       local.get $offset
       i32.add
       local.get $x
       f32.convert_i32_s
       f32.store
       local.get $outPtr
       local.get $offset
       i32.add
       i32.const 4
       i32.add
       local.get $y
       f32.convert_i32_s
       f32.store
       local.get $outPtr
       local.get $offset
       i32.add
       i32.const 8
       i32.add
       f32.const 0
       f32.store
       local.get $outPtr
       local.get $offset
       i32.add
       i32.const 12
       i32.add
       local.get $stride
       f32.convert_i32_s
       f32.store
       local.get $count
       i32.const 1
       i32.add
       local.set $count
      end
      local.get $x
      local.get $stride
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    local.get $stride
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
  local.get $startY
  local.set $y|17
  loop $for-loop|2
   local.get $y|17
   local.get $endY
   i32.le_s
   if
    local.get $y|17
    local.get $h
    i32.lt_s
    if (result i32)
     local.get $y|17
     local.get $w
     i32.mul
    else
     i32.const -1
    end
    local.set $rowOffset|18
    local.get $y|17
    local.get $stride
    i32.ge_s
    if (result i32)
     local.get $y|17
     local.get $stride
     i32.sub
     local.get $w
     i32.mul
    else
     i32.const -1
    end
    local.set $prevRowOffset
    local.get $startX
    local.set $x|20
    loop $for-loop|3
     local.get $x|20
     local.get $endX
     i32.lt_s
     if
      local.get $rowOffset|18
      i32.const -1
      i32.ne
      if (result i32)
       local.get $maskPtr
       local.get $rowOffset|18
       i32.add
       local.get $x|20
       i32.add
       i32.load8_u
      else
       i32.const 0
      end
      local.set $valCurrent|21
      local.get $prevRowOffset
      i32.const -1
      i32.ne
      if (result i32)
       local.get $maskPtr
       local.get $prevRowOffset
       i32.add
       local.get $x|20
       i32.add
       i32.load8_u
      else
       i32.const 0
      end
      local.set $valPrev|22
      local.get $valCurrent|21
      local.get $valPrev|22
      i32.ne
      if
       local.get $count
       local.get $maxSegments
       i32.ge_s
       if
        local.get $count
        return
       end
       local.get $count
       i32.const 4
       i32.shl
       local.set $offset|23
       local.get $outPtr
       local.get $offset|23
       i32.add
       local.get $x|20
       f32.convert_i32_s
       f32.store
       local.get $outPtr
       local.get $offset|23
       i32.add
       i32.const 4
       i32.add
       local.get $y|17
       f32.convert_i32_s
       f32.store
       local.get $outPtr
       local.get $offset|23
       i32.add
       i32.const 8
       i32.add
       local.get $stride
       f32.convert_i32_s
       f32.store
       local.get $outPtr
       local.get $offset|23
       i32.add
       i32.const 12
       i32.add
       f32.const 0
       f32.store
       local.get $count
       i32.const 1
       i32.add
       local.set $count
      end
      local.get $x|20
      local.get $stride
      i32.add
      local.set $x|20
      br $for-loop|3
     end
    end
    local.get $y|17
    local.get $stride
    i32.add
    local.set $y|17
    br $for-loop|2
   end
  end
  local.get $count
  return
 )
 (func $~lib/arraybuffer/ArrayBufferView#get:dataStart (param $this i32) (result i32)
  local.get $this
  i32.load offset=4
 )
 (func $~lib/array/Array<i32>#get:length_ (param $this i32) (result i32)
  local.get $this
  i32.load offset=12
 )
 (func $assembly/vector/pointDistance (param $x1 f32) (param $y1 f32) (param $x2 f32) (param $y2 f32) (result f32)
  (local $dx f32)
  (local $dy f32)
  (local $x f32)
  local.get $x1
  local.get $x2
  f32.sub
  local.set $dx
  local.get $y1
  local.get $y2
  f32.sub
  local.set $dy
  block $~lib/math/NativeMathf.sqrt|inlined.0 (result f32)
   local.get $dx
   local.get $dx
   f32.mul
   local.get $dy
   local.get $dy
   f32.mul
   f32.add
   local.set $x
   local.get $x
   f32.sqrt
   br $~lib/math/NativeMathf.sqrt|inlined.0
  end
  return
 )
 (func $assembly/vector/perpendicularDistance (param $px f32) (param $py f32) (param $x1 f32) (param $y1 f32) (param $x2 f32) (param $y2 f32) (result f32)
  (local $dx f32)
  (local $dy f32)
  (local $x f32)
  (local $mag f32)
  (local $pvx f32)
  (local $pvy f32)
  (local $pvdot f32)
  (local $ax f32)
  (local $ay f32)
  (local $x|15 f32)
  local.get $x2
  local.get $x1
  f32.sub
  local.set $dx
  local.get $y2
  local.get $y1
  f32.sub
  local.set $dy
  block $~lib/math/NativeMathf.sqrt|inlined.1 (result f32)
   local.get $dx
   local.get $dx
   f32.mul
   local.get $dy
   local.get $dy
   f32.mul
   f32.add
   local.set $x
   local.get $x
   f32.sqrt
   br $~lib/math/NativeMathf.sqrt|inlined.1
  end
  local.set $mag
  local.get $mag
  f32.const 0
  f32.gt
  if
   local.get $dx
   local.get $mag
   f32.div
   local.set $dx
   local.get $dy
   local.get $mag
   f32.div
   local.set $dy
  end
  local.get $px
  local.get $x1
  f32.sub
  local.set $pvx
  local.get $py
  local.get $y1
  f32.sub
  local.set $pvy
  local.get $dx
  local.get $pvx
  f32.mul
  local.get $dy
  local.get $pvy
  f32.mul
  f32.add
  local.set $pvdot
  local.get $pvx
  local.get $pvdot
  local.get $dx
  f32.mul
  f32.sub
  local.set $ax
  local.get $pvy
  local.get $pvdot
  local.get $dy
  f32.mul
  f32.sub
  local.set $ay
  block $~lib/math/NativeMathf.sqrt|inlined.2 (result f32)
   local.get $ax
   local.get $ax
   f32.mul
   local.get $ay
   local.get $ay
   f32.mul
   f32.add
   local.set $x|15
   local.get $x|15
   f32.sqrt
   br $~lib/math/NativeMathf.sqrt|inlined.2
  end
  return
 )
 (func $assembly/vector/isPointOnSegment (param $px f32) (param $py f32) (param $x1 f32) (param $y1 f32) (param $x2 f32) (param $y2 f32) (param $tol f32) (result i32)
  (local $dist f32)
  (local $value1 f32)
  (local $value2 f32)
  (local $minX f32)
  (local $value1|11 f32)
  (local $value2|12 f32)
  (local $maxX f32)
  (local $value1|14 f32)
  (local $value2|15 f32)
  (local $minY f32)
  (local $value1|17 f32)
  (local $value2|18 f32)
  (local $maxY f32)
  local.get $px
  local.get $py
  local.get $x1
  local.get $y1
  local.get $x2
  local.get $y2
  call $assembly/vector/perpendicularDistance
  local.set $dist
  local.get $dist
  local.get $tol
  f32.gt
  if
   i32.const 0
   return
  end
  block $~lib/math/NativeMathf.min|inlined.0 (result f32)
   local.get $x1
   local.set $value1
   local.get $x2
   local.set $value2
   local.get $value1
   local.get $value2
   f32.min
   br $~lib/math/NativeMathf.min|inlined.0
  end
  local.get $tol
  f32.sub
  local.set $minX
  block $~lib/math/NativeMathf.max|inlined.0 (result f32)
   local.get $x1
   local.set $value1|11
   local.get $x2
   local.set $value2|12
   local.get $value1|11
   local.get $value2|12
   f32.max
   br $~lib/math/NativeMathf.max|inlined.0
  end
  local.get $tol
  f32.add
  local.set $maxX
  block $~lib/math/NativeMathf.min|inlined.1 (result f32)
   local.get $y1
   local.set $value1|14
   local.get $y2
   local.set $value2|15
   local.get $value1|14
   local.get $value2|15
   f32.min
   br $~lib/math/NativeMathf.min|inlined.1
  end
  local.get $tol
  f32.sub
  local.set $minY
  block $~lib/math/NativeMathf.max|inlined.1 (result f32)
   local.get $y1
   local.set $value1|17
   local.get $y2
   local.set $value2|18
   local.get $value1|17
   local.get $value2|18
   f32.max
   br $~lib/math/NativeMathf.max|inlined.1
  end
  local.get $tol
  f32.add
  local.set $maxY
  local.get $px
  local.get $minX
  f32.ge
  if (result i32)
   local.get $px
   local.get $maxX
   f32.le
  else
   i32.const 0
  end
  if (result i32)
   local.get $py
   local.get $minY
   f32.ge
  else
   i32.const 0
  end
  if (result i32)
   local.get $py
   local.get $maxY
   f32.le
  else
   i32.const 0
  end
  return
 )
 (func $assembly/vector/getCubicBezierPoint (param $t f32) (param $x1 f32) (param $y1 f32) (param $cp1x f32) (param $cp1y f32) (param $cp2x f32) (param $cp2y f32) (param $x2 f32) (param $y2 f32) (result f32)
  (local $invT f32)
  (local $b0 f32)
  (local $b1 f32)
  (local $b2 f32)
  (local $b3 f32)
  f32.const 1
  local.get $t
  f32.sub
  local.set $invT
  local.get $invT
  local.get $invT
  f32.mul
  local.get $invT
  f32.mul
  local.set $b0
  f32.const 3
  local.get $invT
  f32.mul
  local.get $invT
  f32.mul
  local.get $t
  f32.mul
  local.set $b1
  f32.const 3
  local.get $invT
  f32.mul
  local.get $t
  f32.mul
  local.get $t
  f32.mul
  local.set $b2
  local.get $t
  local.get $t
  f32.mul
  local.get $t
  f32.mul
  local.set $b3
  local.get $b0
  local.get $x1
  f32.mul
  local.get $b1
  local.get $cp1x
  f32.mul
  f32.add
  local.get $b2
  local.get $cp2x
  f32.mul
  f32.add
  local.get $b3
  local.get $x2
  f32.mul
  f32.add
  return
 )
 (func $assembly/pdn_effects/relief (param $srcPtr i32) (param $dstPtr i32) (param $w i32) (param $h i32) (param $angle f32) (param $startY i32) (param $endY i32)
  (local $r f32)
  (local $w00 f64)
  (local $w01 f64)
  (local $w02 f64)
  (local $w10 f64)
  (local $w12 f64)
  (local $w20 f64)
  (local $w21 f64)
  (local $w22 f64)
  (local $y i32)
  (local $row i32)
  (local $x i32)
  (local $sumR f64)
  (local $sumG f64)
  (local $sumB f64)
  (local $dy i32)
  (local $py i32)
  (local $pRow i32)
  (local $dx i32)
  (local $px i32)
  (local $weight f64)
  (local $idx i32)
  (local $outIdx i32)
  (local $val f32)
  (local $val|31 f32)
  (local $val|32 f32)
  (local $val|33 f32)
  (local $val|34 f32)
  (local $val|35 f32)
  local.get $angle
  local.set $r
  local.get $r
  f64.promote_f32
  f64.const 0.7853981633974483
  f64.add
  call $~lib/math/NativeMath.cos
  local.set $w00
  local.get $r
  f64.promote_f32
  f32.const 2
  f64.promote_f32
  f64.const 0.7853981633974483
  f64.mul
  f64.add
  call $~lib/math/NativeMath.cos
  local.set $w01
  local.get $r
  f64.promote_f32
  f32.const 3
  f64.promote_f32
  f64.const 0.7853981633974483
  f64.mul
  f64.add
  call $~lib/math/NativeMath.cos
  local.set $w02
  local.get $r
  f64.promote_f32
  call $~lib/math/NativeMath.cos
  local.set $w10
  local.get $r
  f64.promote_f32
  f32.const 4
  f64.promote_f32
  f64.const 0.7853981633974483
  f64.mul
  f64.add
  call $~lib/math/NativeMath.cos
  local.set $w12
  local.get $r
  f64.promote_f32
  f64.const 0.7853981633974483
  f64.sub
  call $~lib/math/NativeMath.cos
  local.set $w20
  local.get $r
  f64.promote_f32
  f32.const 2
  f64.promote_f32
  f64.const 0.7853981633974483
  f64.mul
  f64.sub
  call $~lib/math/NativeMath.cos
  local.set $w21
  local.get $r
  f64.promote_f32
  f32.const 3
  f64.promote_f32
  f64.const 0.7853981633974483
  f64.mul
  f64.sub
  call $~lib/math/NativeMath.cos
  local.set $w22
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $w
     i32.lt_s
     if
      f64.const 0
      local.set $sumR
      f64.const 0
      local.set $sumG
      f64.const 0
      local.set $sumB
      i32.const -1
      local.set $dy
      loop $for-loop|2
       local.get $dy
       i32.const 1
       i32.le_s
       if
        block $for-continue|2
         local.get $y
         local.get $dy
         i32.add
         local.set $py
         local.get $py
         i32.const 0
         i32.lt_s
         if (result i32)
          i32.const 1
         else
          local.get $py
          local.get $h
          i32.ge_s
         end
         if
          br $for-continue|2
         end
         local.get $py
         local.get $w
         i32.mul
         i32.const 4
         i32.mul
         local.set $pRow
         i32.const -1
         local.set $dx
         loop $for-loop|3
          local.get $dx
          i32.const 1
          i32.le_s
          if
           block $for-continue|3
            local.get $x
            local.get $dx
            i32.add
            local.set $px
            local.get $px
            i32.const 0
            i32.lt_s
            if (result i32)
             i32.const 1
            else
             local.get $px
             local.get $w
             i32.ge_s
            end
            if
             br $for-continue|3
            end
            f64.const 0
            local.set $weight
            local.get $dy
            i32.const -1
            i32.eq
            if (result i32)
             local.get $dx
             i32.const -1
             i32.eq
            else
             i32.const 0
            end
            if
             local.get $w00
             local.set $weight
            else
             local.get $dy
             i32.const -1
             i32.eq
             if (result i32)
              local.get $dx
              i32.const 0
              i32.eq
             else
              i32.const 0
             end
             if
              local.get $w01
              local.set $weight
             else
              local.get $dy
              i32.const -1
              i32.eq
              if (result i32)
               local.get $dx
               i32.const 1
               i32.eq
              else
               i32.const 0
              end
              if
               local.get $w02
               local.set $weight
              else
               local.get $dy
               i32.const 0
               i32.eq
               if (result i32)
                local.get $dx
                i32.const -1
                i32.eq
               else
                i32.const 0
               end
               if
                local.get $w10
                local.set $weight
               else
                local.get $dy
                i32.const 0
                i32.eq
                if (result i32)
                 local.get $dx
                 i32.const 0
                 i32.eq
                else
                 i32.const 0
                end
                if
                 f64.const 1
                 local.set $weight
                else
                 local.get $dy
                 i32.const 0
                 i32.eq
                 if (result i32)
                  local.get $dx
                  i32.const 1
                  i32.eq
                 else
                  i32.const 0
                 end
                 if
                  local.get $w12
                  local.set $weight
                 else
                  local.get $dy
                  i32.const 1
                  i32.eq
                  if (result i32)
                   local.get $dx
                   i32.const -1
                   i32.eq
                  else
                   i32.const 0
                  end
                  if
                   local.get $w20
                   local.set $weight
                  else
                   local.get $dy
                   i32.const 1
                   i32.eq
                   if (result i32)
                    local.get $dx
                    i32.const 0
                    i32.eq
                   else
                    i32.const 0
                   end
                   if
                    local.get $w21
                    local.set $weight
                   else
                    local.get $dy
                    i32.const 1
                    i32.eq
                    if (result i32)
                     local.get $dx
                     i32.const 1
                     i32.eq
                    else
                     i32.const 0
                    end
                    if
                     local.get $w22
                     local.set $weight
                    end
                   end
                  end
                 end
                end
               end
              end
             end
            end
            local.get $pRow
            local.get $px
            i32.const 2
            i32.shl
            i32.add
            local.set $idx
            local.get $sumR
            local.get $srcPtr
            local.get $idx
            i32.add
            i32.load8_u
            f64.convert_i32_u
            local.get $weight
            f64.mul
            f64.add
            local.set $sumR
            local.get $sumG
            local.get $srcPtr
            local.get $idx
            i32.add
            i32.const 1
            i32.add
            i32.load8_u
            f64.convert_i32_u
            local.get $weight
            f64.mul
            f64.add
            local.set $sumG
            local.get $sumB
            local.get $srcPtr
            local.get $idx
            i32.add
            i32.const 2
            i32.add
            i32.load8_u
            f64.convert_i32_u
            local.get $weight
            f64.mul
            f64.add
            local.set $sumB
           end
           local.get $dx
           i32.const 1
           i32.add
           local.set $dx
           br $for-loop|3
          end
         end
        end
        local.get $dy
        i32.const 1
        i32.add
        local.set $dy
        br $for-loop|2
       end
      end
      local.get $row
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      local.set $outIdx
      local.get $dstPtr
      local.get $outIdx
      i32.add
      block $assembly/math/clamp255|inlined.41 (result i32)
       local.get $sumR
       f64.const 128
       f64.add
       f32.demote_f64
       local.set $val
       block $assembly/math/isNaN|inlined.52 (result i32)
        local.get $val
        local.set $val|31
        local.get $val|31
        local.get $val|31
        f32.ne
        br $assembly/math/isNaN|inlined.52
       end
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.41
       end
       local.get $val
       f32.const 0
       f32.lt
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.41
       end
       local.get $val
       f32.const 255
       f32.gt
       if
        i32.const 255
        br $assembly/math/clamp255|inlined.41
       end
       local.get $val
       i32.trunc_sat_f32_u
       br $assembly/math/clamp255|inlined.41
      end
      i32.store8
      local.get $dstPtr
      local.get $outIdx
      i32.add
      i32.const 1
      i32.add
      block $assembly/math/clamp255|inlined.42 (result i32)
       local.get $sumG
       f64.const 128
       f64.add
       f32.demote_f64
       local.set $val|32
       block $assembly/math/isNaN|inlined.53 (result i32)
        local.get $val|32
        local.set $val|33
        local.get $val|33
        local.get $val|33
        f32.ne
        br $assembly/math/isNaN|inlined.53
       end
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.42
       end
       local.get $val|32
       f32.const 0
       f32.lt
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.42
       end
       local.get $val|32
       f32.const 255
       f32.gt
       if
        i32.const 255
        br $assembly/math/clamp255|inlined.42
       end
       local.get $val|32
       i32.trunc_sat_f32_u
       br $assembly/math/clamp255|inlined.42
      end
      i32.store8
      local.get $dstPtr
      local.get $outIdx
      i32.add
      i32.const 2
      i32.add
      block $assembly/math/clamp255|inlined.43 (result i32)
       local.get $sumB
       f64.const 128
       f64.add
       f32.demote_f64
       local.set $val|34
       block $assembly/math/isNaN|inlined.54 (result i32)
        local.get $val|34
        local.set $val|35
        local.get $val|35
        local.get $val|35
        f32.ne
        br $assembly/math/isNaN|inlined.54
       end
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.43
       end
       local.get $val|34
       f32.const 0
       f32.lt
       if
        i32.const 0
        br $assembly/math/clamp255|inlined.43
       end
       local.get $val|34
       f32.const 255
       f32.gt
       if
        i32.const 255
        br $assembly/math/clamp255|inlined.43
       end
       local.get $val|34
       i32.trunc_sat_f32_u
       br $assembly/math/clamp255|inlined.43
      end
      i32.store8
      local.get $dstPtr
      local.get $outIdx
      i32.add
      i32.const 3
      i32.add
      local.get $srcPtr
      local.get $outIdx
      i32.add
      i32.const 3
      i32.add
      i32.load8_u
      i32.store8
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $assembly/pdn_effects/randomFloat (result f64)
  global.get $assembly/pdn_effects/seed
  i32.const 1664525
  i32.mul
  i32.const 1013904223
  i32.add
  global.set $assembly/pdn_effects/seed
  global.get $assembly/pdn_effects/seed
  f64.convert_i32_u
  f64.const 4294967296
  f64.div
  return
 )
 (func $assembly/pdn_effects/frostedGlass (param $srcPtr i32) (param $dstPtr i32) (param $w i32) (param $h i32) (param $minRadius f32) (param $maxRadius f32) (param $samples i32) (param $startY i32) (param $endY i32)
  (local $effectiveRadiusDelta f32)
  (local $y i32)
  (local $row i32)
  (local $x i32)
  (local $r i32)
  (local $g i32)
  (local $b i32)
  (local $a i32)
  (local $s i32)
  (local $srcX f32)
  (local $srcY f32)
  (local $valid i32)
  (local $tries i32)
  (local $angle f64)
  (local $distance f64)
  (local $value1 f64)
  (local $value2 f64)
  (local $value1|26 f64)
  (local $value2|27 f64)
  (local $px i32)
  (local $value1|29 f64)
  (local $value2|30 f64)
  (local $value1|31 f64)
  (local $value2|32 f64)
  (local $py i32)
  (local $idx i32)
  (local $outIdx i32)
  local.get $maxRadius
  local.get $minRadius
  f32.sub
  local.set $effectiveRadiusDelta
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $w
     i32.lt_s
     if
      i32.const 0
      local.set $r
      i32.const 0
      local.set $g
      i32.const 0
      local.set $b
      i32.const 0
      local.set $a
      i32.const 0
      local.set $s
      loop $for-loop|2
       local.get $s
       local.get $samples
       i32.lt_s
       if
        f32.const 0
        local.set $srcX
        f32.const 0
        local.set $srcY
        i32.const 0
        local.set $valid
        i32.const 0
        local.set $tries
        block $for-break3
         loop $for-loop|3
          local.get $tries
          i32.const 10
          i32.lt_s
          if
           call $assembly/pdn_effects/randomFloat
           global.get $~lib/math/NativeMath.PI
           f64.mul
           f64.const 2
           f64.mul
           local.set $angle
           call $assembly/pdn_effects/randomFloat
           local.get $effectiveRadiusDelta
           f64.promote_f32
           f64.mul
           local.get $minRadius
           f64.promote_f32
           f64.add
           local.set $distance
           local.get $x
           f32.convert_i32_s
           local.get $angle
           call $~lib/math/NativeMath.cos
           local.get $distance
           f64.mul
           f32.demote_f64
           f32.add
           local.set $srcX
           local.get $y
           f32.convert_i32_s
           local.get $angle
           call $~lib/math/NativeMath.sin
           local.get $distance
           f64.mul
           f32.demote_f64
           f32.add
           local.set $srcY
           local.get $srcX
           f32.const 0
           f32.ge
           if (result i32)
            local.get $srcX
            local.get $w
            f32.convert_i32_s
            f32.lt
           else
            i32.const 0
           end
           if (result i32)
            local.get $srcY
            f32.const 0
            f32.ge
           else
            i32.const 0
           end
           if (result i32)
            local.get $srcY
            local.get $h
            f32.convert_i32_s
            f32.lt
           else
            i32.const 0
           end
           if
            i32.const 1
            local.set $valid
            br $for-break3
           end
           local.get $tries
           i32.const 1
           i32.add
           local.set $tries
           br $for-loop|3
          end
         end
        end
        local.get $valid
        i32.eqz
        if
         local.get $x
         f32.convert_i32_s
         local.set $srcX
         local.get $y
         f32.convert_i32_s
         local.set $srcY
        end
        block $~lib/math/NativeMath.min|inlined.12 (result f64)
         local.get $w
         i32.const 1
         i32.sub
         f32.convert_i32_s
         f64.promote_f32
         local.set $value1|26
         block $~lib/math/NativeMath.max|inlined.14 (result f64)
          f64.const 0
          local.set $value1
          local.get $srcX
          f64.promote_f32
          local.set $value2
          local.get $value1
          local.get $value2
          f64.max
          br $~lib/math/NativeMath.max|inlined.14
         end
         local.set $value2|27
         local.get $value1|26
         local.get $value2|27
         f64.min
         br $~lib/math/NativeMath.min|inlined.12
        end
        i32.trunc_sat_f64_s
        local.set $px
        block $~lib/math/NativeMath.min|inlined.13 (result f64)
         local.get $h
         i32.const 1
         i32.sub
         f32.convert_i32_s
         f64.promote_f32
         local.set $value1|31
         block $~lib/math/NativeMath.max|inlined.15 (result f64)
          f64.const 0
          local.set $value1|29
          local.get $srcY
          f64.promote_f32
          local.set $value2|30
          local.get $value1|29
          local.get $value2|30
          f64.max
          br $~lib/math/NativeMath.max|inlined.15
         end
         local.set $value2|32
         local.get $value1|31
         local.get $value2|32
         f64.min
         br $~lib/math/NativeMath.min|inlined.13
        end
        i32.trunc_sat_f64_s
        local.set $py
        local.get $py
        local.get $w
        i32.mul
        local.get $px
        i32.add
        i32.const 2
        i32.shl
        local.set $idx
        local.get $r
        local.get $srcPtr
        local.get $idx
        i32.add
        i32.load8_u
        i32.add
        local.set $r
        local.get $g
        local.get $srcPtr
        local.get $idx
        i32.add
        i32.const 1
        i32.add
        i32.load8_u
        i32.add
        local.set $g
        local.get $b
        local.get $srcPtr
        local.get $idx
        i32.add
        i32.const 2
        i32.add
        i32.load8_u
        i32.add
        local.set $b
        local.get $a
        local.get $srcPtr
        local.get $idx
        i32.add
        i32.const 3
        i32.add
        i32.load8_u
        i32.add
        local.set $a
        local.get $s
        i32.const 1
        i32.add
        local.set $s
        br $for-loop|2
       end
      end
      local.get $row
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      local.set $outIdx
      local.get $dstPtr
      local.get $outIdx
      i32.add
      local.get $r
      local.get $samples
      i32.div_u
      i32.store8
      local.get $dstPtr
      local.get $outIdx
      i32.add
      i32.const 1
      i32.add
      local.get $g
      local.get $samples
      i32.div_u
      i32.store8
      local.get $dstPtr
      local.get $outIdx
      i32.add
      i32.const 2
      i32.add
      local.get $b
      local.get $samples
      i32.div_u
      i32.store8
      local.get $dstPtr
      local.get $outIdx
      i32.add
      i32.const 3
      i32.add
      local.get $a
      local.get $samples
      i32.div_u
      i32.store8
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $assembly/pdn_effects/redEyeRemove (param $srcPtr i32) (param $dstPtr i32) (param $w i32) (param $h i32) (param $tolerance i32) (param $saturation f32) (param $startY i32) (param $endY i32)
  (local $y i32)
  (local $row i32)
  (local $x i32)
  (local $idx i32)
  (local $r i32)
  (local $g i32)
  (local $b i32)
  (local $a i32)
  (local $s f32)
  (local $value1 f64)
  (local $value2 f64)
  (local $value1|19 f64)
  (local $value2|20 f64)
  (local $minColor f64)
  (local $value1|22 f64)
  (local $value2|23 f64)
  (local $value1|24 f64)
  (local $value2|25 f64)
  (local $maxColor f64)
  (local $delta f64)
  (local $saturationVal i32)
  (local $value1|29 f64)
  (local $value2|30 f64)
  (local $difference f64)
  (local $intensity f32)
  (local $val f32)
  (local $val|34 f32)
  (local $newR i32)
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $w
     i32.lt_s
     if
      local.get $row
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      local.set $idx
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.load8_u
      local.set $r
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 1
      i32.add
      i32.load8_u
      local.set $g
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 2
      i32.add
      i32.load8_u
      local.set $b
      local.get $srcPtr
      local.get $idx
      i32.add
      i32.const 3
      i32.add
      i32.load8_u
      local.set $a
      f32.const 0
      local.set $s
      block $~lib/math/NativeMath.min|inlined.15 (result f64)
       block $~lib/math/NativeMath.min|inlined.14 (result f64)
        local.get $r
        f64.convert_i32_u
        local.set $value1
        local.get $g
        f64.convert_i32_u
        local.set $value2
        local.get $value1
        local.get $value2
        f64.min
        br $~lib/math/NativeMath.min|inlined.14
       end
       local.set $value1|19
       local.get $b
       f64.convert_i32_u
       local.set $value2|20
       local.get $value1|19
       local.get $value2|20
       f64.min
       br $~lib/math/NativeMath.min|inlined.15
      end
      local.set $minColor
      block $~lib/math/NativeMath.max|inlined.17 (result f64)
       block $~lib/math/NativeMath.max|inlined.16 (result f64)
        local.get $r
        f64.convert_i32_u
        local.set $value1|22
        local.get $g
        f64.convert_i32_u
        local.set $value2|23
        local.get $value1|22
        local.get $value2|23
        f64.max
        br $~lib/math/NativeMath.max|inlined.16
       end
       local.set $value1|24
       local.get $b
       f64.convert_i32_u
       local.set $value2|25
       local.get $value1|24
       local.get $value2|25
       f64.max
       br $~lib/math/NativeMath.max|inlined.17
      end
      local.set $maxColor
      local.get $maxColor
      local.get $minColor
      f64.sub
      local.set $delta
      local.get $maxColor
      f64.const 0
      f64.ne
      if (result i32)
       local.get $delta
       f64.const 0
       f64.ne
      else
       i32.const 0
      end
      if
       local.get $delta
       f32.demote_f64
       local.get $maxColor
       f32.demote_f64
       f32.div
       local.set $s
      end
      local.get $s
      f32.const 255
      f32.mul
      i32.trunc_sat_f32_s
      local.set $saturationVal
      local.get $r
      f64.convert_i32_u
      block $~lib/math/NativeMath.max|inlined.18 (result f64)
       local.get $b
       f64.convert_i32_u
       local.set $value1|29
       local.get $g
       f64.convert_i32_u
       local.set $value2|30
       local.get $value1|29
       local.get $value2|30
       f64.max
       br $~lib/math/NativeMath.max|inlined.18
      end
      f64.sub
      local.set $difference
      local.get $difference
      local.get $tolerance
      f64.convert_i32_s
      f64.gt
      if (result i32)
       local.get $saturationVal
       i32.const 100
       i32.gt_s
      else
       i32.const 0
      end
      if
       local.get $r
       f32.convert_i32_u
       f32.const 0.30000001192092896
       f32.mul
       local.get $g
       f32.convert_i32_u
       f32.const 0.5899999737739563
       f32.mul
       f32.add
       local.get $b
       f32.convert_i32_u
       f32.const 0.10999999940395355
       f32.mul
       f32.add
       local.set $intensity
       block $assembly/math/clamp255|inlined.44 (result i32)
        local.get $intensity
        local.get $saturation
        f32.mul
        local.set $val
        block $assembly/math/isNaN|inlined.55 (result i32)
         local.get $val
         local.set $val|34
         local.get $val|34
         local.get $val|34
         f32.ne
         br $assembly/math/isNaN|inlined.55
        end
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.44
        end
        local.get $val
        f32.const 0
        f32.lt
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.44
        end
        local.get $val
        f32.const 255
        f32.gt
        if
         i32.const 255
         br $assembly/math/clamp255|inlined.44
        end
        local.get $val
        i32.trunc_sat_f32_u
        br $assembly/math/clamp255|inlined.44
       end
       local.set $newR
       local.get $dstPtr
       local.get $idx
       i32.add
       local.get $newR
       i32.store8
       local.get $dstPtr
       local.get $idx
       i32.add
       i32.const 1
       i32.add
       local.get $g
       i32.store8
       local.get $dstPtr
       local.get $idx
       i32.add
       i32.const 2
       i32.add
       local.get $b
       i32.store8
       local.get $dstPtr
       local.get $idx
       i32.add
       i32.const 3
       i32.add
       local.get $a
       i32.store8
      else
       local.get $dstPtr
       local.get $idx
       i32.add
       local.get $r
       i32.store8
       local.get $dstPtr
       local.get $idx
       i32.add
       i32.const 1
       i32.add
       local.get $g
       i32.store8
       local.get $dstPtr
       local.get $idx
       i32.add
       i32.const 2
       i32.add
       local.get $b
       i32.store8
       local.get $dstPtr
       local.get $idx
       i32.add
       i32.const 3
       i32.add
       local.get $a
       i32.store8
      end
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
 )
 (func $~lib/rt/__visit_globals (param $0 i32)
  (local $1 i32)
  i32.const 224
  local.get $0
  call $~lib/rt/itcms/__visit
  i32.const 992
  local.get $0
  call $~lib/rt/itcms/__visit
  i32.const 32
  local.get $0
  call $~lib/rt/itcms/__visit
  global.get $assembly/filters/BAYER_MATRIX
  local.tee $1
  if
   local.get $1
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $assembly/math/_hsv
  local.tee $1
  if
   local.get $1
   local.get $0
   call $~lib/rt/itcms/__visit
  end
  global.get $assembly/math/_rgb
  local.tee $1
  if
   local.get $1
   local.get $0
   call $~lib/rt/itcms/__visit
  end
 )
 (func $~lib/arraybuffer/ArrayBufferView~visit (param $0 i32) (param $1 i32)
  (local $2 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  i32.load
  local.get $1
  call $~lib/rt/itcms/__visit
 )
 (func $~lib/object/Object~visit (param $0 i32) (param $1 i32)
 )
 (func $~lib/array/Array<i32>#get:buffer (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/array/Array<i32>~visit (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  local.get $1
  call $~lib/array/Array<i32>#__visit
 )
 (func $~lib/array/Array<~lib/array/Array<i32>>#get:buffer (param $this i32) (result i32)
  local.get $this
  i32.load
 )
 (func $~lib/array/Array<~lib/array/Array<i32>>~visit (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/object/Object~visit
  local.get $0
  local.get $1
  call $~lib/array/Array<~lib/array/Array<i32>>#__visit
 )
 (func $~lib/typedarray/Uint8Array~visit (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/arraybuffer/ArrayBufferView~visit
 )
 (func $~lib/typedarray/Int32Array~visit (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/arraybuffer/ArrayBufferView~visit
 )
 (func $~lib/typedarray/Uint32Array~visit (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  call $~lib/arraybuffer/ArrayBufferView~visit
 )
 (func $~lib/rt/__visit_members (param $0 i32) (param $1 i32)
  block $invalid
   block $~lib/typedarray/Uint32Array
    block $~lib/typedarray/Int32Array
     block $~lib/typedarray/Uint8Array
      block $~lib/array/Array<~lib/array/Array<i32>>
       block $~lib/array/Array<i32>
        block $assembly/math/RGB
         block $assembly/math/HSV
          block $~lib/arraybuffer/ArrayBufferView
           block $~lib/string/String
            block $~lib/arraybuffer/ArrayBuffer
             block $~lib/object/Object
              local.get $0
              i32.const 8
              i32.sub
              i32.load
              br_table $~lib/object/Object $~lib/arraybuffer/ArrayBuffer $~lib/string/String $~lib/arraybuffer/ArrayBufferView $assembly/math/HSV $assembly/math/RGB $~lib/array/Array<i32> $~lib/array/Array<~lib/array/Array<i32>> $~lib/typedarray/Uint8Array $~lib/typedarray/Int32Array $~lib/typedarray/Uint32Array $invalid
             end
             return
            end
            return
           end
           return
          end
          local.get $0
          local.get $1
          call $~lib/arraybuffer/ArrayBufferView~visit
          return
         end
         return
        end
        return
       end
       local.get $0
       local.get $1
       call $~lib/array/Array<i32>~visit
       return
      end
      local.get $0
      local.get $1
      call $~lib/array/Array<~lib/array/Array<i32>>~visit
      return
     end
     local.get $0
     local.get $1
     call $~lib/typedarray/Uint8Array~visit
     return
    end
    local.get $0
    local.get $1
    call $~lib/typedarray/Int32Array~visit
    return
   end
   local.get $0
   local.get $1
   call $~lib/typedarray/Uint32Array~visit
   return
  end
  unreachable
 )
 (func $~start
  call $start:assembly/index
 )
 (func $~stack_check
  global.get $~lib/memory/__stack_pointer
  global.get $~lib/memory/__data_end
  i32.lt_s
  if
   i32.const 40448
   i32.const 40496
   i32.const 1
   i32.const 1
   call $~lib/builtins/abort
   unreachable
  end
 )
 (func $assembly/math/HSV#constructor (param $this i32) (result i32)
  (local $1 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  local.get $this
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 12
   i32.const 4
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  global.get $~lib/memory/__stack_pointer
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  call $~lib/object/Object#constructor
  local.tee $this
  i32.store
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  f32.const 0
  call $assembly/math/HSV#set:h
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  f32.const 0
  call $assembly/math/HSV#set:s
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  f32.const 0
  call $assembly/math/HSV#set:v
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
 (func $assembly/math/RGB#constructor (param $this i32) (result i32)
  (local $1 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  local.get $this
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 12
   i32.const 5
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  global.get $~lib/memory/__stack_pointer
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  call $~lib/object/Object#constructor
  local.tee $this
  i32.store
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  f32.const 0
  call $assembly/math/RGB#set:r
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  f32.const 0
  call $assembly/math/RGB#set:g
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  local.get $1
  i32.store offset=4
  local.get $1
  f32.const 0
  call $assembly/math/RGB#set:b
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
 (func $~lib/array/ensureCapacity (param $array i32) (param $newSize i32) (param $alignLog2 i32) (param $canGrow i32)
  (local $oldCapacity i32)
  (local $oldData i32)
  (local $6 i32)
  (local $7 i32)
  (local $newCapacity i32)
  (local $9 i32)
  (local $10 i32)
  (local $11 i32)
  (local $12 i32)
  (local $newData i32)
  (local $14 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $array
  local.set $14
  global.get $~lib/memory/__stack_pointer
  local.get $14
  i32.store
  local.get $14
  call $~lib/arraybuffer/ArrayBufferView#get:byteLength
  local.set $oldCapacity
  local.get $newSize
  local.get $oldCapacity
  local.get $alignLog2
  i32.shr_u
  i32.gt_u
  if
   local.get $newSize
   i32.const 1073741820
   local.get $alignLog2
   i32.shr_u
   i32.gt_u
   if
    i32.const 992
    i32.const 944
    i32.const 19
    i32.const 48
    call $~lib/builtins/abort
    unreachable
   end
   local.get $array
   local.set $14
   global.get $~lib/memory/__stack_pointer
   local.get $14
   i32.store
   local.get $14
   call $~lib/arraybuffer/ArrayBufferView#get:buffer
   local.set $oldData
   local.get $newSize
   local.tee $6
   i32.const 8
   local.tee $7
   local.get $6
   local.get $7
   i32.gt_u
   select
   local.get $alignLog2
   i32.shl
   local.set $newCapacity
   local.get $canGrow
   if
    local.get $oldCapacity
    i32.const 1
    i32.shl
    local.tee $9
    i32.const 1073741820
    local.tee $10
    local.get $9
    local.get $10
    i32.lt_u
    select
    local.tee $11
    local.get $newCapacity
    local.tee $12
    local.get $11
    local.get $12
    i32.gt_u
    select
    local.set $newCapacity
   end
   local.get $oldData
   local.get $newCapacity
   call $~lib/rt/itcms/__renew
   local.set $newData
   i32.const 2
   global.get $~lib/shared/runtime/Runtime.Incremental
   i32.ne
   drop
   local.get $newData
   local.get $oldData
   i32.ne
   if
    local.get $array
    local.get $newData
    i32.store
    local.get $array
    local.get $newData
    i32.store offset=4
    local.get $array
    local.get $newData
    i32.const 0
    call $~lib/rt/itcms/__link
   end
   local.get $array
   local.get $newCapacity
   i32.store offset=8
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/array/Array<~lib/array/Array<i32>>#__set (param $this i32) (param $index i32) (param $value i32)
  (local $3 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $index
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $~lib/array/Array<~lib/array/Array<i32>>#get:length_
  i32.ge_u
  if
   local.get $index
   i32.const 0
   i32.lt_s
   if
    i32.const 224
    i32.const 944
    i32.const 130
    i32.const 22
    call $~lib/builtins/abort
    unreachable
   end
   local.get $this
   local.get $index
   i32.const 1
   i32.add
   i32.const 2
   i32.const 1
   call $~lib/array/ensureCapacity
   local.get $this
   local.set $3
   global.get $~lib/memory/__stack_pointer
   local.get $3
   i32.store
   local.get $3
   local.get $index
   i32.const 1
   i32.add
   call $~lib/array/Array<~lib/array/Array<i32>>#set:length_
  end
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $~lib/array/Array<~lib/array/Array<i32>>#get:dataStart
  local.get $index
  i32.const 2
  i32.shl
  i32.add
  local.get $value
  i32.store
  i32.const 1
  drop
  local.get $this
  local.get $value
  i32.const 1
  call $~lib/rt/itcms/__link
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/arraybuffer/ArrayBufferView#constructor (param $this i32) (param $length i32) (param $alignLog2 i32) (result i32)
  (local $buffer i32)
  (local $4 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store offset=8
  local.get $this
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 12
   i32.const 3
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  i32.const 0
  call $~lib/arraybuffer/ArrayBufferView#set:buffer
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  i32.const 0
  call $~lib/arraybuffer/ArrayBufferView#set:dataStart
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  i32.const 0
  call $~lib/arraybuffer/ArrayBufferView#set:byteLength
  local.get $length
  i32.const 1073741820
  local.get $alignLog2
  i32.shr_u
  i32.gt_u
  if
   i32.const 992
   i32.const 1040
   i32.const 19
   i32.const 57
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/memory/__stack_pointer
  local.get $length
  local.get $alignLog2
  i32.shl
  local.tee $length
  i32.const 1
  call $~lib/rt/itcms/__new
  local.tee $buffer
  i32.store offset=8
  i32.const 2
  global.get $~lib/shared/runtime/Runtime.Incremental
  i32.ne
  drop
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  local.get $buffer
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=12
  local.get $4
  call $~lib/arraybuffer/ArrayBufferView#set:buffer
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  local.get $buffer
  call $~lib/arraybuffer/ArrayBufferView#set:dataStart
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  local.get $4
  i32.store offset=4
  local.get $4
  local.get $length
  call $~lib/arraybuffer/ArrayBufferView#set:byteLength
  local.get $this
  local.set $4
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $4
 )
 (func $~lib/typedarray/Uint8Array#constructor (param $this i32) (param $length i32) (result i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  local.get $this
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 12
   i32.const 8
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  global.get $~lib/memory/__stack_pointer
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  local.get $length
  i32.const 0
  call $~lib/arraybuffer/ArrayBufferView#constructor
  local.tee $this
  i32.store
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
 )
 (func $assembly/camera_raw/applyCameraRaw (param $dataPtr i32) (param $width i32) (param $height i32) (param $exposure f32) (param $contrast f32) (param $highlights f32) (param $shadows f32) (param $temperature f32) (param $tint f32) (param $vibrance f32) (param $saturation f32) (param $red f32) (param $redHi f32) (param $redSh f32) (param $green f32) (param $greenHi f32) (param $greenSh f32) (param $blue f32) (param $blueHi f32) (param $blueSh f32) (param $hslPtr i32) (param $lutPtr i32) (param $startY i32) (param $endY i32)
  (local $expStops f32)
  (local $mult f32)
  (local $contrastF f32)
  (local $t f32)
  (local $tn f32)
  (local $saturationF f32)
  (local $vibranceF f32)
  (local $lutRGB i32)
  (local $lutR i32)
  (local $lutG i32)
  (local $lutB i32)
  (local $y i32)
  (local $rowOffset i32)
  (local $x i32)
  (local $idx i32)
  (local $rRaw f32)
  (local $gRaw f32)
  (local $bRaw f32)
  (local $a i32)
  (local $c f32)
  (local $cf f32)
  (local $r f32)
  (local $c|46 f32)
  (local $cf|47 f32)
  (local $g f32)
  (local $c|49 f32)
  (local $cf|50 f32)
  (local $b f32)
  (local $Y f32)
  (local $yNew f32)
  (local $sh f32)
  (local $value1 f64)
  (local $value2 f64)
  (local $weight f32)
  (local $x|58 f64)
  (local $hi f32)
  (local $value1|60 f64)
  (local $value2|61 f64)
  (local $weight|62 f32)
  (local $value1|63 f64)
  (local $value2|64 f64)
  (local $multLuma f32)
  (local $value1|66 f64)
  (local $value2|67 f64)
  (local $wHi f32)
  (local $value1|69 f64)
  (local $value2|70 f64)
  (local $wSh f32)
  (local $c|72 f32)
  (local $cf|73 f32)
  (local $r8 f32)
  (local $c|75 f32)
  (local $cf|76 f32)
  (local $g8 f32)
  (local $c|78 f32)
  (local $cf|79 f32)
  (local $b8 f32)
  (local $lr f32)
  (local $lg f32)
  (local $lb f32)
  (local $val f32)
  (local $val|85 f32)
  (local $val|86 f32)
  (local $val|87 f32)
  (local $val|88 f32)
  (local $val|89 f32)
  (local $val|90 f32)
  (local $val|91 f32)
  (local $val|92 f32)
  (local $val|93 f32)
  (local $val|94 f32)
  (local $val|95 f32)
  (local $val|96 f32)
  (local $val|97 f32)
  (local $val|98 f32)
  (local $val|99 f32)
  (local $val|100 f32)
  (local $val|101 f32)
  (local $r|102 f32)
  (local $g|103 f32)
  (local $b|104 f32)
  (local $rf f32)
  (local $gf f32)
  (local $bf f32)
  (local $value1|108 f64)
  (local $value2|109 f64)
  (local $value1|110 f64)
  (local $value2|111 f64)
  (local $max f32)
  (local $value1|113 f64)
  (local $value2|114 f64)
  (local $value1|115 f64)
  (local $value2|116 f64)
  (local $min f32)
  (local $d f32)
  (local $h f32)
  (local $s f32)
  (local $v f32)
  (local $hsv i32)
  (local $h|123 f32)
  (local $i1 i32)
  (local $i2 i32)
  (local $w1 f32)
  (local $w2 f32)
  (local $h1 f32)
  (local $s1 f32)
  (local $l1 f32)
  (local $h2 f32)
  (local $s2 f32)
  (local $l2 f32)
  (local $mixH f32)
  (local $mixS f32)
  (local $mixV f32)
  (local $value1|137 f64)
  (local $value2|138 f64)
  (local $value1|139 f64)
  (local $value2|140 f64)
  (local $value1|141 f64)
  (local $value2|142 f64)
  (local $value1|143 f64)
  (local $value2|144 f64)
  (local $h|145 f32)
  (local $s|146 f32)
  (local $v|147 f32)
  (local $hf f32)
  (local $sf f32)
  (local $vf f32)
  (local $x|151 f64)
  (local $i i32)
  (local $f f32)
  (local $p f32)
  (local $q f32)
  (local $t|156 f32)
  (local $r|157 f32)
  (local $g|158 f32)
  (local $b|159 f32)
  (local $160 i32)
  (local $rgb i32)
  (local $avg f32)
  (local $value1|163 f64)
  (local $value2|164 f64)
  (local $value1|165 f64)
  (local $value2|166 f64)
  (local $max_val f32)
  (local $amt f32)
  (local $gray f32)
  (local $val|170 f32)
  (local $val|171 f32)
  (local $val|172 f32)
  (local $val|173 f32)
  (local $val|174 f32)
  (local $val|175 f32)
  (local $176 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store offset=8
  local.get $endY
  i32.const 0
  i32.lt_s
  if
   local.get $height
   local.set $endY
  end
  local.get $startY
  i32.const 0
  i32.lt_s
  if
   i32.const 0
   local.set $startY
  end
  local.get $endY
  local.get $height
  i32.gt_s
  if
   local.get $height
   local.set $endY
  end
  local.get $exposure
  f32.const 100
  f32.div
  f32.const 2
  f32.mul
  local.set $expStops
  f64.const 2
  local.get $expStops
  f64.promote_f32
  call $~lib/math/NativeMath.pow
  f32.demote_f64
  local.set $mult
  f32.const 100
  local.get $contrast
  f32.add
  f32.const 100
  f32.div
  local.set $contrastF
  local.get $temperature
  f32.const 100
  f32.div
  local.set $t
  local.get $tint
  f32.const 100
  f32.div
  local.set $tn
  f32.const 100
  local.get $saturation
  f32.add
  f32.const 100
  f32.div
  local.set $saturationF
  local.get $vibrance
  f32.const 100
  f32.div
  local.set $vibranceF
  local.get $lutPtr
  local.set $lutRGB
  local.get $lutPtr
  i32.const 256
  i32.add
  local.set $lutR
  local.get $lutPtr
  i32.const 512
  i32.add
  local.set $lutG
  local.get $lutPtr
  i32.const 768
  i32.add
  local.set $lutB
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $width
    i32.mul
    i32.const 4
    i32.mul
    local.set $rowOffset
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $width
     i32.lt_s
     if
      block $for-continue|1
       local.get $rowOffset
       local.get $x
       i32.const 2
       i32.shl
       i32.add
       local.set $idx
       local.get $dataPtr
       local.get $idx
       i32.add
       i32.load8_u
       f32.convert_i32_u
       local.set $rRaw
       local.get $dataPtr
       local.get $idx
       i32.add
       i32.const 1
       i32.add
       i32.load8_u
       f32.convert_i32_u
       local.set $gRaw
       local.get $dataPtr
       local.get $idx
       i32.add
       i32.const 2
       i32.add
       i32.load8_u
       f32.convert_i32_u
       local.set $bRaw
       local.get $dataPtr
       local.get $idx
       i32.add
       i32.const 3
       i32.add
       i32.load8_u
       local.set $a
       local.get $a
       i32.const 0
       i32.eq
       if
        br $for-continue|1
       end
       block $assembly/camera_raw/srgbToLinear|inlined.0 (result f32)
        local.get $rRaw
        local.set $c
        local.get $c
        f32.const 255
        f32.div
        local.set $cf
        local.get $cf
        f32.const 0
        f32.le
        if
         f32.const 0
         br $assembly/camera_raw/srgbToLinear|inlined.0
        end
        local.get $cf
        f32.const 1
        f32.ge
        if
         f32.const 1
         br $assembly/camera_raw/srgbToLinear|inlined.0
        end
        local.get $cf
        f32.const 0.040449999272823334
        f32.le
        if (result f32)
         local.get $cf
         f32.const 12.920000076293945
         f32.div
        else
         local.get $cf
         f32.const 0.054999999701976776
         f32.add
         f64.promote_f32
         f64.const 1.055
         f64.div
         f64.const 2.4
         call $~lib/math/NativeMath.pow
         f32.demote_f64
        end
        br $assembly/camera_raw/srgbToLinear|inlined.0
       end
       local.set $r
       block $assembly/camera_raw/srgbToLinear|inlined.1 (result f32)
        local.get $gRaw
        local.set $c|46
        local.get $c|46
        f32.const 255
        f32.div
        local.set $cf|47
        local.get $cf|47
        f32.const 0
        f32.le
        if
         f32.const 0
         br $assembly/camera_raw/srgbToLinear|inlined.1
        end
        local.get $cf|47
        f32.const 1
        f32.ge
        if
         f32.const 1
         br $assembly/camera_raw/srgbToLinear|inlined.1
        end
        local.get $cf|47
        f32.const 0.040449999272823334
        f32.le
        if (result f32)
         local.get $cf|47
         f32.const 12.920000076293945
         f32.div
        else
         local.get $cf|47
         f32.const 0.054999999701976776
         f32.add
         f64.promote_f32
         f64.const 1.055
         f64.div
         f64.const 2.4
         call $~lib/math/NativeMath.pow
         f32.demote_f64
        end
        br $assembly/camera_raw/srgbToLinear|inlined.1
       end
       local.set $g
       block $assembly/camera_raw/srgbToLinear|inlined.2 (result f32)
        local.get $bRaw
        local.set $c|49
        local.get $c|49
        f32.const 255
        f32.div
        local.set $cf|50
        local.get $cf|50
        f32.const 0
        f32.le
        if
         f32.const 0
         br $assembly/camera_raw/srgbToLinear|inlined.2
        end
        local.get $cf|50
        f32.const 1
        f32.ge
        if
         f32.const 1
         br $assembly/camera_raw/srgbToLinear|inlined.2
        end
        local.get $cf|50
        f32.const 0.040449999272823334
        f32.le
        if (result f32)
         local.get $cf|50
         f32.const 12.920000076293945
         f32.div
        else
         local.get $cf|50
         f32.const 0.054999999701976776
         f32.add
         f64.promote_f32
         f64.const 1.055
         f64.div
         f64.const 2.4
         call $~lib/math/NativeMath.pow
         f32.demote_f64
        end
        br $assembly/camera_raw/srgbToLinear|inlined.2
       end
       local.set $b
       local.get $r
       local.get $mult
       f32.mul
       local.set $r
       local.get $g
       local.get $mult
       f32.mul
       local.set $g
       local.get $b
       local.get $mult
       f32.mul
       local.set $b
       local.get $t
       f32.const 0
       f32.ne
       if
        local.get $r
        f32.const 1
        local.get $t
        f32.const 0.11999999731779099
        f32.mul
        f32.add
        f32.mul
        local.set $r
        local.get $b
        f32.const 1
        local.get $t
        f32.const 0.11999999731779099
        f32.mul
        f32.sub
        f32.mul
        local.set $b
        local.get $g
        f32.const 1
        local.get $t
        f32.const 0.019999999552965164
        f32.mul
        f32.add
        f32.mul
        local.set $g
       end
       local.get $tn
       f32.const 0
       f32.ne
       if
        local.get $r
        f32.const 1
        local.get $tn
        f32.const 0.05999999865889549
        f32.mul
        f32.add
        f32.mul
        local.set $r
        local.get $b
        f32.const 1
        local.get $tn
        f32.const 0.05999999865889549
        f32.mul
        f32.add
        f32.mul
        local.set $b
        local.get $g
        f32.const 1
        local.get $tn
        f32.const 0.07999999821186066
        f32.mul
        f32.sub
        f32.mul
        local.set $g
       end
       f32.const 0.2125999927520752
       local.get $r
       f32.mul
       f32.const 0.7152000069618225
       local.get $g
       f32.mul
       f32.add
       f32.const 0.0722000002861023
       local.get $b
       f32.mul
       f32.add
       local.set $Y
       local.get $Y
       f32.const 1.0000000474974513e-03
       f32.gt
       if
        local.get $Y
        local.set $yNew
        local.get $shadows
        f32.const 0
        f32.ne
        if
         local.get $shadows
         f32.const 100
         f32.div
         local.set $sh
         block $~lib/math/NativeMath.max|inlined.0 (result f64)
          f32.const 0
          f64.promote_f32
          local.set $value1
          f32.const 1
          local.get $Y
          f32.const 0.5
          f32.div
          f32.sub
          f64.promote_f32
          local.set $value2
          local.get $value1
          local.get $value2
          f64.max
          br $~lib/math/NativeMath.max|inlined.0
         end
         f32.demote_f64
         local.set $weight
         local.get $yNew
         local.get $sh
         local.get $weight
         f32.mul
         f32.const 0.4000000059604645
         f32.mul
         block $~lib/math/NativeMath.sqrt|inlined.0 (result f64)
          local.get $Y
          f64.promote_f32
          local.set $x|58
          local.get $x|58
          f64.sqrt
          br $~lib/math/NativeMath.sqrt|inlined.0
         end
         f32.demote_f64
         f32.mul
         f32.add
         local.set $yNew
        end
        local.get $highlights
        f32.const 0
        f32.ne
        if
         local.get $highlights
         f32.const 100
         f32.div
         local.set $hi
         block $~lib/math/NativeMath.max|inlined.1 (result f64)
          f32.const 0
          f64.promote_f32
          local.set $value1|60
          local.get $Y
          f32.const 0.5
          f32.sub
          f32.const 0.5
          f32.div
          f64.promote_f32
          local.set $value2|61
          local.get $value1|60
          local.get $value2|61
          f64.max
          br $~lib/math/NativeMath.max|inlined.1
         end
         f32.demote_f64
         local.set $weight|62
         local.get $yNew
         local.get $hi
         local.get $weight|62
         f32.mul
         f32.const 0.6000000238418579
         f32.mul
         f32.const 1.100000023841858
         local.get $Y
         f32.sub
         f32.mul
         f32.add
         local.set $yNew
        end
        block $~lib/math/NativeMath.max|inlined.2 (result f64)
         f32.const 0
         f64.promote_f32
         local.set $value1|63
         local.get $yNew
         f64.promote_f32
         local.set $value2|64
         local.get $value1|63
         local.get $value2|64
         f64.max
         br $~lib/math/NativeMath.max|inlined.2
        end
        f32.demote_f64
        local.set $yNew
        local.get $yNew
        local.get $Y
        f32.div
        local.set $multLuma
        local.get $r
        local.get $multLuma
        f32.mul
        local.set $r
        local.get $g
        local.get $multLuma
        f32.mul
        local.set $g
        local.get $b
        local.get $multLuma
        f32.mul
        local.set $b
       end
       local.get $red
       f32.const 0
       f32.ne
       if (result i32)
        i32.const 1
       else
        local.get $redHi
        f32.const 0
        f32.ne
       end
       if (result i32)
        i32.const 1
       else
        local.get $redSh
        f32.const 0
        f32.ne
       end
       if (result i32)
        i32.const 1
       else
        local.get $green
        f32.const 0
        f32.ne
       end
       if (result i32)
        i32.const 1
       else
        local.get $greenHi
        f32.const 0
        f32.ne
       end
       if (result i32)
        i32.const 1
       else
        local.get $greenSh
        f32.const 0
        f32.ne
       end
       if (result i32)
        i32.const 1
       else
        local.get $blue
        f32.const 0
        f32.ne
       end
       if (result i32)
        i32.const 1
       else
        local.get $blueHi
        f32.const 0
        f32.ne
       end
       if (result i32)
        i32.const 1
       else
        local.get $blueSh
        f32.const 0
        f32.ne
       end
       if
        block $~lib/math/NativeMath.max|inlined.3 (result f64)
         f32.const 0
         f64.promote_f32
         local.set $value1|66
         local.get $Y
         f32.const 0.5
         f32.sub
         f64.promote_f32
         local.set $value2|67
         local.get $value1|66
         local.get $value2|67
         f64.max
         br $~lib/math/NativeMath.max|inlined.3
        end
        f32.demote_f64
        f32.const 0.5
        f32.div
        local.set $wHi
        block $~lib/math/NativeMath.max|inlined.4 (result f64)
         f32.const 0
         f64.promote_f32
         local.set $value1|69
         f32.const 0.5
         local.get $Y
         f32.sub
         f64.promote_f32
         local.set $value2|70
         local.get $value1|69
         local.get $value2|70
         f64.max
         br $~lib/math/NativeMath.max|inlined.4
        end
        f32.demote_f64
        f32.const 0.5
        f32.div
        local.set $wSh
        local.get $red
        f32.const 0
        f32.ne
        if
         local.get $r
         f32.const 1
         local.get $red
         f32.const 100
         f32.div
         f32.add
         f32.mul
         local.set $r
        end
        local.get $redHi
        f32.const 0
        f32.ne
        if
         local.get $r
         f32.const 1
         local.get $redHi
         f32.const 100
         f32.div
         local.get $wHi
         f32.mul
         f32.const 1.5
         f32.mul
         f32.add
         f32.mul
         local.set $r
        end
        local.get $redSh
        f32.const 0
        f32.ne
        if
         local.get $r
         f32.const 1
         local.get $redSh
         f32.const 100
         f32.div
         local.get $wSh
         f32.mul
         f32.const 1.5
         f32.mul
         f32.add
         f32.mul
         local.set $r
        end
        local.get $green
        f32.const 0
        f32.ne
        if
         local.get $g
         f32.const 1
         local.get $green
         f32.const 100
         f32.div
         f32.add
         f32.mul
         local.set $g
        end
        local.get $greenHi
        f32.const 0
        f32.ne
        if
         local.get $g
         f32.const 1
         local.get $greenHi
         f32.const 100
         f32.div
         local.get $wHi
         f32.mul
         f32.const 1.5
         f32.mul
         f32.add
         f32.mul
         local.set $g
        end
        local.get $greenSh
        f32.const 0
        f32.ne
        if
         local.get $g
         f32.const 1
         local.get $greenSh
         f32.const 100
         f32.div
         local.get $wSh
         f32.mul
         f32.const 1.5
         f32.mul
         f32.add
         f32.mul
         local.set $g
        end
        local.get $blue
        f32.const 0
        f32.ne
        if
         local.get $b
         f32.const 1
         local.get $blue
         f32.const 100
         f32.div
         f32.add
         f32.mul
         local.set $b
        end
        local.get $blueHi
        f32.const 0
        f32.ne
        if
         local.get $b
         f32.const 1
         local.get $blueHi
         f32.const 100
         f32.div
         local.get $wHi
         f32.mul
         f32.const 1.5
         f32.mul
         f32.add
         f32.mul
         local.set $b
        end
        local.get $blueSh
        f32.const 0
        f32.ne
        if
         local.get $b
         f32.const 1
         local.get $blueSh
         f32.const 100
         f32.div
         local.get $wSh
         f32.mul
         f32.const 1.5
         f32.mul
         f32.add
         f32.mul
         local.set $b
        end
       end
       block $assembly/camera_raw/linearToSrgb|inlined.0 (result f32)
        local.get $r
        local.set $c|72
        local.get $c|72
        f32.const 0
        f32.le
        if
         f32.const 0
         br $assembly/camera_raw/linearToSrgb|inlined.0
        end
        local.get $c|72
        f32.const 1
        f32.ge
        if
         f32.const 255
         br $assembly/camera_raw/linearToSrgb|inlined.0
        end
        local.get $c|72
        f32.const 3.1308000907301903e-03
        f32.le
        if (result f32)
         f32.const 12.920000076293945
         local.get $c|72
         f32.mul
        else
         f32.const 1.0549999475479126
         local.get $c|72
         f64.promote_f32
         f64.const 1
         f64.const 2.4
         f64.div
         call $~lib/math/NativeMath.pow
         f32.demote_f64
         f32.mul
         f32.const 0.054999999701976776
         f32.sub
        end
        local.set $cf|73
        local.get $cf|73
        f32.const 255
        f32.mul
        br $assembly/camera_raw/linearToSrgb|inlined.0
       end
       local.set $r8
       block $assembly/camera_raw/linearToSrgb|inlined.1 (result f32)
        local.get $g
        local.set $c|75
        local.get $c|75
        f32.const 0
        f32.le
        if
         f32.const 0
         br $assembly/camera_raw/linearToSrgb|inlined.1
        end
        local.get $c|75
        f32.const 1
        f32.ge
        if
         f32.const 255
         br $assembly/camera_raw/linearToSrgb|inlined.1
        end
        local.get $c|75
        f32.const 3.1308000907301903e-03
        f32.le
        if (result f32)
         f32.const 12.920000076293945
         local.get $c|75
         f32.mul
        else
         f32.const 1.0549999475479126
         local.get $c|75
         f64.promote_f32
         f64.const 1
         f64.const 2.4
         f64.div
         call $~lib/math/NativeMath.pow
         f32.demote_f64
         f32.mul
         f32.const 0.054999999701976776
         f32.sub
        end
        local.set $cf|76
        local.get $cf|76
        f32.const 255
        f32.mul
        br $assembly/camera_raw/linearToSrgb|inlined.1
       end
       local.set $g8
       block $assembly/camera_raw/linearToSrgb|inlined.2 (result f32)
        local.get $b
        local.set $c|78
        local.get $c|78
        f32.const 0
        f32.le
        if
         f32.const 0
         br $assembly/camera_raw/linearToSrgb|inlined.2
        end
        local.get $c|78
        f32.const 1
        f32.ge
        if
         f32.const 255
         br $assembly/camera_raw/linearToSrgb|inlined.2
        end
        local.get $c|78
        f32.const 3.1308000907301903e-03
        f32.le
        if (result f32)
         f32.const 12.920000076293945
         local.get $c|78
         f32.mul
        else
         f32.const 1.0549999475479126
         local.get $c|78
         f64.promote_f32
         f64.const 1
         f64.const 2.4
         f64.div
         call $~lib/math/NativeMath.pow
         f32.demote_f64
         f32.mul
         f32.const 0.054999999701976776
         f32.sub
        end
        local.set $cf|79
        local.get $cf|79
        f32.const 255
        f32.mul
        br $assembly/camera_raw/linearToSrgb|inlined.2
       end
       local.set $b8
       local.get $r8
       f32.const 255
       f32.div
       local.set $lr
       local.get $g8
       f32.const 255
       f32.div
       local.set $lg
       local.get $b8
       f32.const 255
       f32.div
       local.set $lb
       block $assembly/math/clamp01|inlined.0 (result f32)
        f32.const 0.5
        local.get $lr
        f32.const 0.5
        f32.sub
        local.get $contrastF
        f32.mul
        f32.add
        local.set $val
        block $assembly/math/isNaN|inlined.0 (result i32)
         local.get $val
         local.set $val|85
         local.get $val|85
         local.get $val|85
         f32.ne
         br $assembly/math/isNaN|inlined.0
        end
        if
         f32.const 0
         br $assembly/math/clamp01|inlined.0
        end
        local.get $val
        f32.const 0
        f32.lt
        if
         f32.const 0
         br $assembly/math/clamp01|inlined.0
        end
        local.get $val
        f32.const 1
        f32.gt
        if
         f32.const 1
         br $assembly/math/clamp01|inlined.0
        end
        local.get $val
        br $assembly/math/clamp01|inlined.0
       end
       local.set $lr
       block $assembly/math/clamp01|inlined.1 (result f32)
        f32.const 0.5
        local.get $lg
        f32.const 0.5
        f32.sub
        local.get $contrastF
        f32.mul
        f32.add
        local.set $val|86
        block $assembly/math/isNaN|inlined.1 (result i32)
         local.get $val|86
         local.set $val|87
         local.get $val|87
         local.get $val|87
         f32.ne
         br $assembly/math/isNaN|inlined.1
        end
        if
         f32.const 0
         br $assembly/math/clamp01|inlined.1
        end
        local.get $val|86
        f32.const 0
        f32.lt
        if
         f32.const 0
         br $assembly/math/clamp01|inlined.1
        end
        local.get $val|86
        f32.const 1
        f32.gt
        if
         f32.const 1
         br $assembly/math/clamp01|inlined.1
        end
        local.get $val|86
        br $assembly/math/clamp01|inlined.1
       end
       local.set $lg
       block $assembly/math/clamp01|inlined.2 (result f32)
        f32.const 0.5
        local.get $lb
        f32.const 0.5
        f32.sub
        local.get $contrastF
        f32.mul
        f32.add
        local.set $val|88
        block $assembly/math/isNaN|inlined.2 (result i32)
         local.get $val|88
         local.set $val|89
         local.get $val|89
         local.get $val|89
         f32.ne
         br $assembly/math/isNaN|inlined.2
        end
        if
         f32.const 0
         br $assembly/math/clamp01|inlined.2
        end
        local.get $val|88
        f32.const 0
        f32.lt
        if
         f32.const 0
         br $assembly/math/clamp01|inlined.2
        end
        local.get $val|88
        f32.const 1
        f32.gt
        if
         f32.const 1
         br $assembly/math/clamp01|inlined.2
        end
        local.get $val|88
        br $assembly/math/clamp01|inlined.2
       end
       local.set $lb
       local.get $lr
       f32.const 255
       f32.mul
       local.set $r8
       local.get $lg
       f32.const 255
       f32.mul
       local.set $g8
       local.get $lb
       f32.const 255
       f32.mul
       local.set $b8
       local.get $lutPtr
       i32.const 0
       i32.ne
       if
        local.get $lutR
        block $assembly/math/clamp255|inlined.0 (result i32)
         local.get $r8
         local.set $val|90
         block $assembly/math/isNaN|inlined.3 (result i32)
          local.get $val|90
          local.set $val|91
          local.get $val|91
          local.get $val|91
          f32.ne
          br $assembly/math/isNaN|inlined.3
         end
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.0
         end
         local.get $val|90
         f32.const 0
         f32.lt
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.0
         end
         local.get $val|90
         f32.const 255
         f32.gt
         if
          i32.const 255
          br $assembly/math/clamp255|inlined.0
         end
         local.get $val|90
         i32.trunc_sat_f32_u
         br $assembly/math/clamp255|inlined.0
        end
        i32.const 255
        i32.and
        i32.add
        i32.load8_u
        f32.convert_i32_u
        local.set $r8
        local.get $lutG
        block $assembly/math/clamp255|inlined.1 (result i32)
         local.get $g8
         local.set $val|92
         block $assembly/math/isNaN|inlined.4 (result i32)
          local.get $val|92
          local.set $val|93
          local.get $val|93
          local.get $val|93
          f32.ne
          br $assembly/math/isNaN|inlined.4
         end
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.1
         end
         local.get $val|92
         f32.const 0
         f32.lt
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.1
         end
         local.get $val|92
         f32.const 255
         f32.gt
         if
          i32.const 255
          br $assembly/math/clamp255|inlined.1
         end
         local.get $val|92
         i32.trunc_sat_f32_u
         br $assembly/math/clamp255|inlined.1
        end
        i32.const 255
        i32.and
        i32.add
        i32.load8_u
        f32.convert_i32_u
        local.set $g8
        local.get $lutB
        block $assembly/math/clamp255|inlined.2 (result i32)
         local.get $b8
         local.set $val|94
         block $assembly/math/isNaN|inlined.5 (result i32)
          local.get $val|94
          local.set $val|95
          local.get $val|95
          local.get $val|95
          f32.ne
          br $assembly/math/isNaN|inlined.5
         end
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.2
         end
         local.get $val|94
         f32.const 0
         f32.lt
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.2
         end
         local.get $val|94
         f32.const 255
         f32.gt
         if
          i32.const 255
          br $assembly/math/clamp255|inlined.2
         end
         local.get $val|94
         i32.trunc_sat_f32_u
         br $assembly/math/clamp255|inlined.2
        end
        i32.const 255
        i32.and
        i32.add
        i32.load8_u
        f32.convert_i32_u
        local.set $b8
        local.get $lutRGB
        block $assembly/math/clamp255|inlined.3 (result i32)
         local.get $r8
         local.set $val|96
         block $assembly/math/isNaN|inlined.6 (result i32)
          local.get $val|96
          local.set $val|97
          local.get $val|97
          local.get $val|97
          f32.ne
          br $assembly/math/isNaN|inlined.6
         end
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.3
         end
         local.get $val|96
         f32.const 0
         f32.lt
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.3
         end
         local.get $val|96
         f32.const 255
         f32.gt
         if
          i32.const 255
          br $assembly/math/clamp255|inlined.3
         end
         local.get $val|96
         i32.trunc_sat_f32_u
         br $assembly/math/clamp255|inlined.3
        end
        i32.const 255
        i32.and
        i32.add
        i32.load8_u
        f32.convert_i32_u
        local.set $r8
        local.get $lutRGB
        block $assembly/math/clamp255|inlined.4 (result i32)
         local.get $g8
         local.set $val|98
         block $assembly/math/isNaN|inlined.7 (result i32)
          local.get $val|98
          local.set $val|99
          local.get $val|99
          local.get $val|99
          f32.ne
          br $assembly/math/isNaN|inlined.7
         end
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.4
         end
         local.get $val|98
         f32.const 0
         f32.lt
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.4
         end
         local.get $val|98
         f32.const 255
         f32.gt
         if
          i32.const 255
          br $assembly/math/clamp255|inlined.4
         end
         local.get $val|98
         i32.trunc_sat_f32_u
         br $assembly/math/clamp255|inlined.4
        end
        i32.const 255
        i32.and
        i32.add
        i32.load8_u
        f32.convert_i32_u
        local.set $g8
        local.get $lutRGB
        block $assembly/math/clamp255|inlined.5 (result i32)
         local.get $b8
         local.set $val|100
         block $assembly/math/isNaN|inlined.8 (result i32)
          local.get $val|100
          local.set $val|101
          local.get $val|101
          local.get $val|101
          f32.ne
          br $assembly/math/isNaN|inlined.8
         end
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.5
         end
         local.get $val|100
         f32.const 0
         f32.lt
         if
          i32.const 0
          br $assembly/math/clamp255|inlined.5
         end
         local.get $val|100
         f32.const 255
         f32.gt
         if
          i32.const 255
          br $assembly/math/clamp255|inlined.5
         end
         local.get $val|100
         i32.trunc_sat_f32_u
         br $assembly/math/clamp255|inlined.5
        end
        i32.const 255
        i32.and
        i32.add
        i32.load8_u
        f32.convert_i32_u
        local.set $b8
       end
       local.get $hslPtr
       i32.const 0
       i32.ne
       if
        global.get $~lib/memory/__stack_pointer
        block $assembly/math/rgbToHsv|inlined.0 (result i32)
         local.get $r8
         local.set $r|102
         local.get $g8
         local.set $g|103
         local.get $b8
         local.set $b|104
         local.get $r|102
         f32.const 255
         f32.div
         local.set $rf
         local.get $g|103
         f32.const 255
         f32.div
         local.set $gf
         local.get $b|104
         f32.const 255
         f32.div
         local.set $bf
         block $~lib/math/NativeMath.max|inlined.6 (result f64)
          local.get $rf
          f64.promote_f32
          local.set $value1|110
          block $~lib/math/NativeMath.max|inlined.5 (result f64)
           local.get $gf
           f64.promote_f32
           local.set $value1|108
           local.get $bf
           f64.promote_f32
           local.set $value2|109
           local.get $value1|108
           local.get $value2|109
           f64.max
           br $~lib/math/NativeMath.max|inlined.5
          end
          f32.demote_f64
          f64.promote_f32
          local.set $value2|111
          local.get $value1|110
          local.get $value2|111
          f64.max
          br $~lib/math/NativeMath.max|inlined.6
         end
         f32.demote_f64
         local.set $max
         block $~lib/math/NativeMath.min|inlined.1 (result f64)
          local.get $rf
          f64.promote_f32
          local.set $value1|115
          block $~lib/math/NativeMath.min|inlined.0 (result f64)
           local.get $gf
           f64.promote_f32
           local.set $value1|113
           local.get $bf
           f64.promote_f32
           local.set $value2|114
           local.get $value1|113
           local.get $value2|114
           f64.min
           br $~lib/math/NativeMath.min|inlined.0
          end
          f32.demote_f64
          f64.promote_f32
          local.set $value2|116
          local.get $value1|115
          local.get $value2|116
          f64.min
          br $~lib/math/NativeMath.min|inlined.1
         end
         f32.demote_f64
         local.set $min
         local.get $max
         local.get $min
         f32.sub
         local.set $d
         f32.const 0
         local.set $h
         f32.const 0
         local.set $s
         local.get $max
         local.set $v
         local.get $max
         f32.const 0
         f32.eq
         if (result f32)
          f32.const 0
         else
          local.get $d
          local.get $max
          f32.div
         end
         local.set $s
         local.get $max
         local.get $min
         f32.eq
         if (result i32)
          i32.const 1
         else
          local.get $d
          f32.const 9.999999747378752e-06
          f32.lt
         end
         if
          f32.const 0
          local.set $h
         else
          local.get $max
          local.get $rf
          f32.eq
          if
           local.get $gf
           local.get $bf
           f32.sub
           local.get $d
           f32.div
           local.get $gf
           local.get $bf
           f32.lt
           if (result f32)
            f32.const 6
           else
            f32.const 0
           end
           f32.add
           local.set $h
          else
           local.get $max
           local.get $gf
           f32.eq
           if
            local.get $bf
            local.get $rf
            f32.sub
            local.get $d
            f32.div
            f32.const 2
            f32.add
            local.set $h
           else
            local.get $rf
            local.get $gf
            f32.sub
            local.get $d
            f32.div
            f32.const 4
            f32.add
            local.set $h
           end
          end
          local.get $h
          f32.const 6
          f32.div
          local.set $h
         end
         global.get $assembly/math/_hsv
         local.set $176
         global.get $~lib/memory/__stack_pointer
         local.get $176
         i32.store
         local.get $176
         local.get $h
         f32.const 360
         f32.mul
         call $assembly/math/HSV#set:h
         global.get $assembly/math/_hsv
         local.set $176
         global.get $~lib/memory/__stack_pointer
         local.get $176
         i32.store
         local.get $176
         local.get $s
         f32.const 100
         f32.mul
         call $assembly/math/HSV#set:s
         global.get $assembly/math/_hsv
         local.set $176
         global.get $~lib/memory/__stack_pointer
         local.get $176
         i32.store
         local.get $176
         local.get $v
         f32.const 100
         f32.mul
         call $assembly/math/HSV#set:v
         global.get $assembly/math/_hsv
         br $assembly/math/rgbToHsv|inlined.0
        end
        local.tee $hsv
        i32.store offset=4
        local.get $hsv
        local.set $176
        global.get $~lib/memory/__stack_pointer
        local.get $176
        i32.store
        local.get $176
        call $assembly/math/HSV#get:h
        local.set $h|123
        i32.const 0
        local.set $i1
        i32.const 0
        local.set $i2
        f32.const 0
        local.set $w1
        f32.const 0
        local.set $w2
        local.get $h|123
        f32.const 30
        f32.lt
        if
         i32.const 0
         local.set $i1
         i32.const 1
         local.set $i2
         f32.const 1
         local.get $h|123
         f32.const 30
         f32.div
         f32.sub
         local.set $w1
         local.get $h|123
         f32.const 30
         f32.div
         local.set $w2
        else
         local.get $h|123
         f32.const 60
         f32.lt
         if
          i32.const 1
          local.set $i1
          i32.const 2
          local.set $i2
          f32.const 1
          local.get $h|123
          f32.const 30
          f32.sub
          f32.const 30
          f32.div
          f32.sub
          local.set $w1
          local.get $h|123
          f32.const 30
          f32.sub
          f32.const 30
          f32.div
          local.set $w2
         else
          local.get $h|123
          f32.const 120
          f32.lt
          if
           i32.const 2
           local.set $i1
           i32.const 3
           local.set $i2
           f32.const 1
           local.get $h|123
           f32.const 60
           f32.sub
           f32.const 60
           f32.div
           f32.sub
           local.set $w1
           local.get $h|123
           f32.const 60
           f32.sub
           f32.const 60
           f32.div
           local.set $w2
          else
           local.get $h|123
           f32.const 180
           f32.lt
           if
            i32.const 3
            local.set $i1
            i32.const 4
            local.set $i2
            f32.const 1
            local.get $h|123
            f32.const 120
            f32.sub
            f32.const 60
            f32.div
            f32.sub
            local.set $w1
            local.get $h|123
            f32.const 120
            f32.sub
            f32.const 60
            f32.div
            local.set $w2
           else
            local.get $h|123
            f32.const 240
            f32.lt
            if
             i32.const 4
             local.set $i1
             i32.const 5
             local.set $i2
             f32.const 1
             local.get $h|123
             f32.const 180
             f32.sub
             f32.const 60
             f32.div
             f32.sub
             local.set $w1
             local.get $h|123
             f32.const 180
             f32.sub
             f32.const 60
             f32.div
             local.set $w2
            else
             local.get $h|123
             f32.const 280
             f32.lt
             if
              i32.const 5
              local.set $i1
              i32.const 6
              local.set $i2
              f32.const 1
              local.get $h|123
              f32.const 240
              f32.sub
              f32.const 40
              f32.div
              f32.sub
              local.set $w1
              local.get $h|123
              f32.const 240
              f32.sub
              f32.const 40
              f32.div
              local.set $w2
             else
              local.get $h|123
              f32.const 320
              f32.lt
              if
               i32.const 6
               local.set $i1
               i32.const 7
               local.set $i2
               f32.const 1
               local.get $h|123
               f32.const 280
               f32.sub
               f32.const 40
               f32.div
               f32.sub
               local.set $w1
               local.get $h|123
               f32.const 280
               f32.sub
               f32.const 40
               f32.div
               local.set $w2
              else
               i32.const 7
               local.set $i1
               i32.const 0
               local.set $i2
               f32.const 1
               local.get $h|123
               f32.const 320
               f32.sub
               f32.const 40
               f32.div
               f32.sub
               local.set $w1
               local.get $h|123
               f32.const 320
               f32.sub
               f32.const 40
               f32.div
               local.set $w2
              end
             end
            end
           end
          end
         end
        end
        local.get $hslPtr
        local.get $i1
        i32.const 12
        i32.mul
        i32.add
        f32.load
        local.set $h1
        local.get $hslPtr
        local.get $i1
        i32.const 12
        i32.mul
        i32.add
        i32.const 4
        i32.add
        f32.load
        local.set $s1
        local.get $hslPtr
        local.get $i1
        i32.const 12
        i32.mul
        i32.add
        i32.const 8
        i32.add
        f32.load
        local.set $l1
        local.get $hslPtr
        local.get $i2
        i32.const 12
        i32.mul
        i32.add
        f32.load
        local.set $h2
        local.get $hslPtr
        local.get $i2
        i32.const 12
        i32.mul
        i32.add
        i32.const 4
        i32.add
        f32.load
        local.set $s2
        local.get $hslPtr
        local.get $i2
        i32.const 12
        i32.mul
        i32.add
        i32.const 8
        i32.add
        f32.load
        local.set $l2
        local.get $h1
        local.get $w1
        f32.mul
        local.get $h2
        local.get $w2
        f32.mul
        f32.add
        local.set $mixH
        local.get $s1
        local.get $w1
        f32.mul
        local.get $s2
        local.get $w2
        f32.mul
        f32.add
        local.set $mixS
        local.get $l1
        local.get $w1
        f32.mul
        local.get $l2
        local.get $w2
        f32.mul
        f32.add
        local.set $mixV
        local.get $hsv
        local.set $176
        global.get $~lib/memory/__stack_pointer
        local.get $176
        i32.store
        local.get $176
        local.get $hsv
        local.set $176
        global.get $~lib/memory/__stack_pointer
        local.get $176
        i32.store offset=8
        local.get $176
        call $assembly/math/HSV#get:h
        local.get $mixH
        f32.add
        f32.const 3600
        f32.add
        f32.const 360
        call $~lib/math/NativeMathf.mod
        call $assembly/math/HSV#set:h
        local.get $hsv
        local.set $176
        global.get $~lib/memory/__stack_pointer
        local.get $176
        i32.store
        local.get $176
        block $~lib/math/NativeMath.max|inlined.7 (result f64)
         f64.const 0
         local.set $value1|139
         block $~lib/math/NativeMath.min|inlined.2 (result f64)
          f64.const 100
          local.set $value1|137
          local.get $hsv
          local.set $176
          global.get $~lib/memory/__stack_pointer
          local.get $176
          i32.store offset=8
          local.get $176
          call $assembly/math/HSV#get:s
          local.get $mixS
          f32.add
          f64.promote_f32
          local.set $value2|138
          local.get $value1|137
          local.get $value2|138
          f64.min
          br $~lib/math/NativeMath.min|inlined.2
         end
         local.set $value2|140
         local.get $value1|139
         local.get $value2|140
         f64.max
         br $~lib/math/NativeMath.max|inlined.7
        end
        f32.demote_f64
        call $assembly/math/HSV#set:s
        local.get $hsv
        local.set $176
        global.get $~lib/memory/__stack_pointer
        local.get $176
        i32.store
        local.get $176
        block $~lib/math/NativeMath.max|inlined.8 (result f64)
         f64.const 0
         local.set $value1|143
         block $~lib/math/NativeMath.min|inlined.3 (result f64)
          f64.const 100
          local.set $value1|141
          local.get $hsv
          local.set $176
          global.get $~lib/memory/__stack_pointer
          local.get $176
          i32.store offset=8
          local.get $176
          call $assembly/math/HSV#get:v
          local.get $mixV
          f32.add
          f64.promote_f32
          local.set $value2|142
          local.get $value1|141
          local.get $value2|142
          f64.min
          br $~lib/math/NativeMath.min|inlined.3
         end
         local.set $value2|144
         local.get $value1|143
         local.get $value2|144
         f64.max
         br $~lib/math/NativeMath.max|inlined.8
        end
        f32.demote_f64
        call $assembly/math/HSV#set:v
        global.get $~lib/memory/__stack_pointer
        block $assembly/math/hsvToRgb|inlined.0 (result i32)
         local.get $hsv
         local.set $176
         global.get $~lib/memory/__stack_pointer
         local.get $176
         i32.store
         local.get $176
         call $assembly/math/HSV#get:h
         local.set $h|145
         local.get $hsv
         local.set $176
         global.get $~lib/memory/__stack_pointer
         local.get $176
         i32.store
         local.get $176
         call $assembly/math/HSV#get:s
         local.set $s|146
         local.get $hsv
         local.set $176
         global.get $~lib/memory/__stack_pointer
         local.get $176
         i32.store
         local.get $176
         call $assembly/math/HSV#get:v
         local.set $v|147
         local.get $h|145
         f32.const 360
         f32.div
         local.set $hf
         local.get $s|146
         f32.const 100
         f32.div
         local.set $sf
         local.get $v|147
         f32.const 100
         f32.div
         local.set $vf
         local.get $hf
         f32.const 0
         f32.lt
         if
          f32.const 0
          local.set $hf
         end
         local.get $hf
         f32.const 1
         f32.gt
         if
          f32.const 1
          local.set $hf
         end
         local.get $sf
         f32.const 0
         f32.lt
         if
          f32.const 0
          local.set $sf
         end
         local.get $sf
         f32.const 1
         f32.gt
         if
          f32.const 1
          local.set $sf
         end
         local.get $vf
         f32.const 0
         f32.lt
         if
          f32.const 0
          local.set $vf
         end
         local.get $vf
         f32.const 1
         f32.gt
         if
          f32.const 1
          local.set $vf
         end
         block $~lib/math/NativeMath.floor|inlined.0 (result f64)
          local.get $hf
          f32.const 6
          f32.mul
          f64.promote_f32
          local.set $x|151
          local.get $x|151
          f64.floor
          br $~lib/math/NativeMath.floor|inlined.0
         end
         i32.trunc_sat_f64_s
         local.set $i
         local.get $hf
         f32.const 6
         f32.mul
         local.get $i
         f32.convert_i32_s
         f32.sub
         local.set $f
         local.get $vf
         f32.const 1
         local.get $sf
         f32.sub
         f32.mul
         local.set $p
         local.get $vf
         f32.const 1
         local.get $f
         local.get $sf
         f32.mul
         f32.sub
         f32.mul
         local.set $q
         local.get $vf
         f32.const 1
         f32.const 1
         local.get $f
         f32.sub
         local.get $sf
         f32.mul
         f32.sub
         f32.mul
         local.set $t|156
         f32.const 0
         local.set $r|157
         f32.const 0
         local.set $g|158
         f32.const 0
         local.set $b|159
         block $break|2
          block $case5|2
           block $case4|2
            block $case3|2
             block $case2|2
              block $case1|2
               block $case0|2
                local.get $i
                i32.const 6
                i32.rem_s
                local.set $160
                local.get $160
                i32.const 0
                i32.eq
                br_if $case0|2
                local.get $160
                i32.const 1
                i32.eq
                br_if $case1|2
                local.get $160
                i32.const 2
                i32.eq
                br_if $case2|2
                local.get $160
                i32.const 3
                i32.eq
                br_if $case3|2
                local.get $160
                i32.const 4
                i32.eq
                br_if $case4|2
                br $case5|2
               end
               local.get $vf
               local.set $r|157
               local.get $t|156
               local.set $g|158
               local.get $p
               local.set $b|159
               br $break|2
              end
              local.get $q
              local.set $r|157
              local.get $vf
              local.set $g|158
              local.get $p
              local.set $b|159
              br $break|2
             end
             local.get $p
             local.set $r|157
             local.get $vf
             local.set $g|158
             local.get $t|156
             local.set $b|159
             br $break|2
            end
            local.get $p
            local.set $r|157
            local.get $q
            local.set $g|158
            local.get $vf
            local.set $b|159
            br $break|2
           end
           local.get $t|156
           local.set $r|157
           local.get $p
           local.set $g|158
           local.get $vf
           local.set $b|159
           br $break|2
          end
          local.get $vf
          local.set $r|157
          local.get $p
          local.set $g|158
          local.get $q
          local.set $b|159
          br $break|2
         end
         global.get $assembly/math/_rgb
         local.set $176
         global.get $~lib/memory/__stack_pointer
         local.get $176
         i32.store
         local.get $176
         local.get $r|157
         f32.const 255
         f32.mul
         call $assembly/math/RGB#set:r
         global.get $assembly/math/_rgb
         local.set $176
         global.get $~lib/memory/__stack_pointer
         local.get $176
         i32.store
         local.get $176
         local.get $g|158
         f32.const 255
         f32.mul
         call $assembly/math/RGB#set:g
         global.get $assembly/math/_rgb
         local.set $176
         global.get $~lib/memory/__stack_pointer
         local.get $176
         i32.store
         local.get $176
         local.get $b|159
         f32.const 255
         f32.mul
         call $assembly/math/RGB#set:b
         global.get $assembly/math/_rgb
         br $assembly/math/hsvToRgb|inlined.0
        end
        local.tee $rgb
        i32.store offset=12
        local.get $rgb
        local.set $176
        global.get $~lib/memory/__stack_pointer
        local.get $176
        i32.store
        local.get $176
        call $assembly/math/RGB#get:r
        local.set $r8
        local.get $rgb
        local.set $176
        global.get $~lib/memory/__stack_pointer
        local.get $176
        i32.store
        local.get $176
        call $assembly/math/RGB#get:g
        local.set $g8
        local.get $rgb
        local.set $176
        global.get $~lib/memory/__stack_pointer
        local.get $176
        i32.store
        local.get $176
        call $assembly/math/RGB#get:b
        local.set $b8
       end
       local.get $vibranceF
       f32.const 0
       f32.ne
       if (result i32)
        i32.const 1
       else
        local.get $saturationF
        f32.const 1
        f32.ne
       end
       if
        local.get $r8
        local.get $g8
        f32.add
        local.get $b8
        f32.add
        f32.const 3
        f32.div
        local.set $avg
        block $~lib/math/NativeMath.max|inlined.10 (result f64)
         local.get $r8
         f64.promote_f32
         local.set $value1|165
         block $~lib/math/NativeMath.max|inlined.9 (result f64)
          local.get $g8
          f64.promote_f32
          local.set $value1|163
          local.get $b8
          f64.promote_f32
          local.set $value2|164
          local.get $value1|163
          local.get $value2|164
          f64.max
          br $~lib/math/NativeMath.max|inlined.9
         end
         f32.demote_f64
         f64.promote_f32
         local.set $value2|166
         local.get $value1|165
         local.get $value2|166
         f64.max
         br $~lib/math/NativeMath.max|inlined.10
        end
        f32.demote_f64
        local.set $max_val
        local.get $max_val
        local.get $avg
        f32.sub
        f32.const 255
        f32.div
        local.get $vibranceF
        f32.mul
        local.set $amt
        local.get $r8
        local.get $max_val
        local.get $r8
        f32.sub
        local.get $amt
        f32.mul
        f32.add
        local.set $r8
        local.get $g8
        local.get $max_val
        local.get $g8
        f32.sub
        local.get $amt
        f32.mul
        f32.add
        local.set $g8
        local.get $b8
        local.get $max_val
        local.get $b8
        f32.sub
        local.get $amt
        f32.mul
        f32.add
        local.set $b8
        f32.const 0.29899999499320984
        local.get $r8
        f32.mul
        f32.const 0.5870000123977661
        local.get $g8
        f32.mul
        f32.add
        f32.const 0.11400000005960464
        local.get $b8
        f32.mul
        f32.add
        local.set $gray
        local.get $gray
        local.get $r8
        local.get $gray
        f32.sub
        local.get $saturationF
        f32.mul
        f32.add
        local.set $r8
        local.get $gray
        local.get $g8
        local.get $gray
        f32.sub
        local.get $saturationF
        f32.mul
        f32.add
        local.set $g8
        local.get $gray
        local.get $b8
        local.get $gray
        f32.sub
        local.get $saturationF
        f32.mul
        f32.add
        local.set $b8
       end
       local.get $dataPtr
       local.get $idx
       i32.add
       block $assembly/math/clamp255|inlined.6 (result i32)
        local.get $r8
        local.set $val|170
        block $assembly/math/isNaN|inlined.9 (result i32)
         local.get $val|170
         local.set $val|171
         local.get $val|171
         local.get $val|171
         f32.ne
         br $assembly/math/isNaN|inlined.9
        end
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.6
        end
        local.get $val|170
        f32.const 0
        f32.lt
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.6
        end
        local.get $val|170
        f32.const 255
        f32.gt
        if
         i32.const 255
         br $assembly/math/clamp255|inlined.6
        end
        local.get $val|170
        i32.trunc_sat_f32_u
        br $assembly/math/clamp255|inlined.6
       end
       i32.store8
       local.get $dataPtr
       local.get $idx
       i32.add
       i32.const 1
       i32.add
       block $assembly/math/clamp255|inlined.7 (result i32)
        local.get $g8
        local.set $val|172
        block $assembly/math/isNaN|inlined.10 (result i32)
         local.get $val|172
         local.set $val|173
         local.get $val|173
         local.get $val|173
         f32.ne
         br $assembly/math/isNaN|inlined.10
        end
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.7
        end
        local.get $val|172
        f32.const 0
        f32.lt
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.7
        end
        local.get $val|172
        f32.const 255
        f32.gt
        if
         i32.const 255
         br $assembly/math/clamp255|inlined.7
        end
        local.get $val|172
        i32.trunc_sat_f32_u
        br $assembly/math/clamp255|inlined.7
       end
       i32.store8
       local.get $dataPtr
       local.get $idx
       i32.add
       i32.const 2
       i32.add
       block $assembly/math/clamp255|inlined.8 (result i32)
        local.get $b8
        local.set $val|174
        block $assembly/math/isNaN|inlined.11 (result i32)
         local.get $val|174
         local.set $val|175
         local.get $val|175
         local.get $val|175
         f32.ne
         br $assembly/math/isNaN|inlined.11
        end
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.8
        end
        local.get $val|174
        f32.const 0
        f32.lt
        if
         i32.const 0
         br $assembly/math/clamp255|inlined.8
        end
        local.get $val|174
        f32.const 255
        f32.gt
        if
         i32.const 255
         br $assembly/math/clamp255|inlined.8
        end
        local.get $val|174
        i32.trunc_sat_f32_u
        br $assembly/math/clamp255|inlined.8
       end
       i32.store8
      end
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 16
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/array/Array<~lib/array/Array<i32>>#__uget (param $this i32) (param $index i32) (result i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/array/Array<~lib/array/Array<i32>>#get:dataStart
  local.get $index
  i32.const 2
  i32.shl
  i32.add
  i32.load
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
  return
 )
 (func $~lib/array/Array<i32>#__uget (param $this i32) (param $index i32) (result i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/array/Array<i32>#get:dataStart
  local.get $index
  i32.const 2
  i32.shl
  i32.add
  i32.load
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
  return
 )
 (func $assembly/filters/orderedDither (param $srcPtr i32) (param $w i32) (param $h i32) (param $size i32) (param $invert i32) (param $startY i32) (param $endY i32)
  (local $s i32)
  (local $y i32)
  (local $row i32)
  (local $my i32)
  (local $x i32)
  (local $idx i32)
  (local $a i32)
  (local $r i32)
  (local $g i32)
  (local $b i32)
  (local $luma f32)
  (local $mx i32)
  (local $threshold f32)
  (local $v i32)
  (local $color i32)
  (local $22 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  local.get $size
  i32.const 0
  i32.gt_s
  if (result i32)
   local.get $size
  else
   i32.const 1
  end
  local.set $s
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    local.get $y
    local.get $s
    i32.div_s
    i32.const 8
    i32.rem_s
    local.set $my
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $w
     i32.lt_s
     if
      block $for-continue|1
       local.get $row
       local.get $x
       i32.const 2
       i32.shl
       i32.add
       local.set $idx
       local.get $srcPtr
       local.get $idx
       i32.add
       i32.const 3
       i32.add
       i32.load8_u
       local.set $a
       local.get $a
       i32.const 128
       i32.lt_u
       if
        local.get $srcPtr
        local.get $idx
        i32.add
        i32.const 0
        i32.store
        br $for-continue|1
       end
       local.get $srcPtr
       local.get $idx
       i32.add
       i32.load8_u
       local.set $r
       local.get $srcPtr
       local.get $idx
       i32.add
       i32.const 1
       i32.add
       i32.load8_u
       local.set $g
       local.get $srcPtr
       local.get $idx
       i32.add
       i32.const 2
       i32.add
       i32.load8_u
       local.set $b
       f32.const 0.29899999499320984
       local.get $r
       f32.convert_i32_u
       f32.mul
       f32.const 0.5870000123977661
       local.get $g
       f32.convert_i32_u
       f32.mul
       f32.add
       f32.const 0.11400000005960464
       local.get $b
       f32.convert_i32_u
       f32.mul
       f32.add
       local.set $luma
       local.get $x
       local.get $s
       i32.div_s
       i32.const 8
       i32.rem_s
       local.set $mx
       global.get $assembly/filters/BAYER_MATRIX
       local.set $22
       global.get $~lib/memory/__stack_pointer
       local.get $22
       i32.store offset=4
       local.get $22
       local.get $my
       call $~lib/array/Array<~lib/array/Array<i32>>#__uget
       local.set $22
       global.get $~lib/memory/__stack_pointer
       local.get $22
       i32.store
       local.get $22
       local.get $mx
       call $~lib/array/Array<i32>#__uget
       f32.convert_i32_s
       f32.const 4
       f32.mul
       local.set $threshold
       local.get $luma
       local.get $threshold
       f32.ge
       if (result i32)
        i32.const 255
       else
        i32.const 0
       end
       local.set $v
       local.get $invert
       if
        i32.const 255
        local.get $v
        i32.sub
        local.set $v
       end
       local.get $v
       i32.const 255
       i32.and
       local.get $v
       i32.const 255
       i32.and
       i32.const 8
       i32.shl
       i32.or
       local.get $v
       i32.const 255
       i32.and
       i32.const 16
       i32.shl
       i32.or
       i32.const 255
       i32.const 24
       i32.shl
       i32.or
       local.set $color
       local.get $srcPtr
       local.get $idx
       i32.add
       local.get $color
       i32.store
      end
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/typedarray/Int32Array#constructor (param $this i32) (param $length i32) (result i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  local.get $this
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 12
   i32.const 9
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  global.get $~lib/memory/__stack_pointer
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  local.get $length
  i32.const 2
  call $~lib/arraybuffer/ArrayBufferView#constructor
  local.tee $this
  i32.store
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
 )
 (func $~lib/typedarray/Int32Array#__set (param $this i32) (param $index i32) (param $value i32)
  (local $3 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $index
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $~lib/arraybuffer/ArrayBufferView#get:byteLength
  i32.const 2
  i32.shr_u
  i32.ge_u
  if
   i32.const 224
   i32.const 7456
   i32.const 747
   i32.const 64
   call $~lib/builtins/abort
   unreachable
  end
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $~lib/arraybuffer/ArrayBufferView#get:dataStart
  local.get $index
  i32.const 2
  i32.shl
  i32.add
  local.get $value
  i32.store
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/typedarray/Uint8Array#__set (param $this i32) (param $index i32) (param $value i32)
  (local $3 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $index
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $~lib/arraybuffer/ArrayBufferView#get:byteLength
  i32.ge_u
  if
   i32.const 224
   i32.const 7456
   i32.const 178
   i32.const 45
   call $~lib/builtins/abort
   unreachable
  end
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $~lib/arraybuffer/ArrayBufferView#get:dataStart
  local.get $index
  i32.add
  local.get $value
  i32.store8
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/typedarray/Int32Array#__get (param $this i32) (param $index i32) (result i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $index
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/arraybuffer/ArrayBufferView#get:byteLength
  i32.const 2
  i32.shr_u
  i32.ge_u
  if
   i32.const 224
   i32.const 7456
   i32.const 736
   i32.const 64
   call $~lib/builtins/abort
   unreachable
  end
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/arraybuffer/ArrayBufferView#get:dataStart
  local.get $index
  i32.const 2
  i32.shl
  i32.add
  i32.load
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
  return
 )
 (func $~lib/array/Array<i32>#__get (param $this i32) (param $index i32) (result i32)
  (local $value i32)
  (local $3 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $index
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $~lib/array/Array<i32>#get:length_
  i32.ge_u
  if
   i32.const 224
   i32.const 944
   i32.const 114
   i32.const 42
   call $~lib/builtins/abort
   unreachable
  end
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $~lib/array/Array<i32>#get:dataStart
  local.get $index
  i32.const 2
  i32.shl
  i32.add
  i32.load
  local.set $value
  i32.const 0
  drop
  local.get $value
  local.set $3
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $3
  return
 )
 (func $~lib/typedarray/Uint8Array#__get (param $this i32) (param $index i32) (result i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $index
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/arraybuffer/ArrayBufferView#get:byteLength
  i32.ge_u
  if
   i32.const 224
   i32.const 7456
   i32.const 167
   i32.const 45
   call $~lib/builtins/abort
   unreachable
  end
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/arraybuffer/ArrayBufferView#get:dataStart
  local.get $index
  i32.add
  i32.load8_u
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
  return
 )
 (func $assembly/filters/magicWand (param $dataPtr i32) (param $maskPtr i32) (param $w i32) (param $h i32) (param $startX i32) (param $startY i32) (param $sr i32) (param $sg i32) (param $sb i32) (param $sa i32) (param $tol f32)
  (local $tolSq f32)
  (local $size i32)
  (local $visited i32)
  (local $stack i32)
  (local $stackPtr i32)
  (local $16 i32)
  (local $17 i32)
  (local $y i32)
  (local $x i32)
  (local $20 i32)
  (local $dx i32)
  (local $22 i32)
  (local $dy i32)
  (local $i i32)
  (local $nx i32)
  (local $ny i32)
  (local $vi i32)
  (local $idx i32)
  (local $dr f32)
  (local $dg f32)
  (local $db f32)
  (local $da f32)
  (local $33 i32)
  (local $34 i32)
  (local $35 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 20
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.const 20
  memory.fill
  local.get $tol
  local.get $tol
  f32.mul
  local.set $tolSq
  local.get $w
  local.get $h
  i32.mul
  local.set $size
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  local.get $size
  call $~lib/typedarray/Uint8Array#constructor
  local.tee $visited
  i32.store
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  local.get $size
  i32.const 2
  i32.mul
  call $~lib/typedarray/Int32Array#constructor
  local.tee $stack
  i32.store offset=4
  i32.const 0
  local.set $stackPtr
  local.get $stack
  local.set $35
  global.get $~lib/memory/__stack_pointer
  local.get $35
  i32.store offset=8
  local.get $35
  local.get $stackPtr
  local.tee $16
  i32.const 1
  i32.add
  local.set $stackPtr
  local.get $16
  local.get $startX
  call $~lib/typedarray/Int32Array#__set
  local.get $stack
  local.set $35
  global.get $~lib/memory/__stack_pointer
  local.get $35
  i32.store offset=8
  local.get $35
  local.get $stackPtr
  local.tee $17
  i32.const 1
  i32.add
  local.set $stackPtr
  local.get $17
  local.get $startY
  call $~lib/typedarray/Int32Array#__set
  local.get $visited
  local.set $35
  global.get $~lib/memory/__stack_pointer
  local.get $35
  i32.store offset=8
  local.get $35
  local.get $startY
  local.get $w
  i32.mul
  local.get $startX
  i32.add
  i32.const 1
  call $~lib/typedarray/Uint8Array#__set
  local.get $maskPtr
  local.get $startY
  local.get $w
  i32.mul
  i32.add
  local.get $startX
  i32.add
  i32.const 1
  i32.store8
  loop $while-continue|0
   local.get $stackPtr
   i32.const 0
   i32.gt_s
   if
    local.get $stack
    local.set $35
    global.get $~lib/memory/__stack_pointer
    local.get $35
    i32.store offset=8
    local.get $35
    local.get $stackPtr
    i32.const 1
    i32.sub
    local.tee $stackPtr
    call $~lib/typedarray/Int32Array#__get
    local.set $y
    local.get $stack
    local.set $35
    global.get $~lib/memory/__stack_pointer
    local.get $35
    i32.store offset=8
    local.get $35
    local.get $stackPtr
    i32.const 1
    i32.sub
    local.tee $stackPtr
    call $~lib/typedarray/Int32Array#__get
    local.set $x
    global.get $~lib/memory/__stack_pointer
    i32.const 4
    i32.const 2
    i32.const 6
    i32.const 7520
    call $~lib/rt/__newArray
    local.tee $dx
    i32.store offset=12
    global.get $~lib/memory/__stack_pointer
    i32.const 4
    i32.const 2
    i32.const 6
    i32.const 7568
    call $~lib/rt/__newArray
    local.tee $dy
    i32.store offset=16
    i32.const 0
    local.set $i
    loop $for-loop|1
     local.get $i
     i32.const 4
     i32.lt_s
     if
      local.get $x
      local.get $dx
      local.set $35
      global.get $~lib/memory/__stack_pointer
      local.get $35
      i32.store offset=8
      local.get $35
      local.get $i
      call $~lib/array/Array<i32>#__get
      i32.add
      local.set $nx
      local.get $y
      local.get $dy
      local.set $35
      global.get $~lib/memory/__stack_pointer
      local.get $35
      i32.store offset=8
      local.get $35
      local.get $i
      call $~lib/array/Array<i32>#__get
      i32.add
      local.set $ny
      local.get $nx
      i32.const 0
      i32.ge_s
      if (result i32)
       local.get $nx
       local.get $w
       i32.lt_s
      else
       i32.const 0
      end
      if (result i32)
       local.get $ny
       i32.const 0
       i32.ge_s
      else
       i32.const 0
      end
      if (result i32)
       local.get $ny
       local.get $h
       i32.lt_s
      else
       i32.const 0
      end
      if
       local.get $ny
       local.get $w
       i32.mul
       local.get $nx
       i32.add
       local.set $vi
       local.get $visited
       local.set $35
       global.get $~lib/memory/__stack_pointer
       local.get $35
       i32.store offset=8
       local.get $35
       local.get $vi
       call $~lib/typedarray/Uint8Array#__get
       i32.eqz
       if
        local.get $visited
        local.set $35
        global.get $~lib/memory/__stack_pointer
        local.get $35
        i32.store offset=8
        local.get $35
        local.get $vi
        i32.const 1
        call $~lib/typedarray/Uint8Array#__set
        local.get $vi
        i32.const 2
        i32.shl
        local.set $idx
        local.get $dataPtr
        local.get $idx
        i32.add
        i32.load8_u
        f32.convert_i32_u
        local.get $sr
        i32.const 255
        i32.and
        f32.convert_i32_u
        f32.sub
        local.set $dr
        local.get $dataPtr
        local.get $idx
        i32.add
        i32.const 1
        i32.add
        i32.load8_u
        f32.convert_i32_u
        local.get $sg
        i32.const 255
        i32.and
        f32.convert_i32_u
        f32.sub
        local.set $dg
        local.get $dataPtr
        local.get $idx
        i32.add
        i32.const 2
        i32.add
        i32.load8_u
        f32.convert_i32_u
        local.get $sb
        i32.const 255
        i32.and
        f32.convert_i32_u
        f32.sub
        local.set $db
        local.get $dataPtr
        local.get $idx
        i32.add
        i32.const 3
        i32.add
        i32.load8_u
        f32.convert_i32_u
        local.get $sa
        i32.const 255
        i32.and
        f32.convert_i32_u
        f32.sub
        local.set $da
        local.get $dr
        local.get $dr
        f32.mul
        local.get $dg
        local.get $dg
        f32.mul
        f32.add
        local.get $db
        local.get $db
        f32.mul
        f32.add
        local.get $da
        local.get $da
        f32.mul
        f32.add
        local.get $tolSq
        f32.le
        if
         local.get $maskPtr
         local.get $vi
         i32.add
         i32.const 1
         i32.store8
         local.get $stack
         local.set $35
         global.get $~lib/memory/__stack_pointer
         local.get $35
         i32.store offset=8
         local.get $35
         local.get $stackPtr
         local.tee $33
         i32.const 1
         i32.add
         local.set $stackPtr
         local.get $33
         local.get $nx
         call $~lib/typedarray/Int32Array#__set
         local.get $stack
         local.set $35
         global.get $~lib/memory/__stack_pointer
         local.get $35
         i32.store offset=8
         local.get $35
         local.get $stackPtr
         local.tee $34
         i32.const 1
         i32.add
         local.set $stackPtr
         local.get $34
         local.get $ny
         call $~lib/typedarray/Int32Array#__set
        end
       end
      end
      local.get $i
      i32.const 1
      i32.add
      local.set $i
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
 )
 (func $~lib/typedarray/Uint32Array#constructor (param $this i32) (param $length i32) (result i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i64.const 0
  i64.store
  local.get $this
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 12
   i32.const 10
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  global.get $~lib/memory/__stack_pointer
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store offset=4
  local.get $2
  local.get $length
  i32.const 2
  call $~lib/arraybuffer/ArrayBufferView#constructor
  local.tee $this
  i32.store
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 8
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
 )
 (func $~lib/typedarray/Uint32Array#__set (param $this i32) (param $index i32) (param $value i32)
  (local $3 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $index
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $~lib/arraybuffer/ArrayBufferView#get:byteLength
  i32.const 2
  i32.shr_u
  i32.ge_u
  if
   i32.const 224
   i32.const 7456
   i32.const 889
   i32.const 64
   call $~lib/builtins/abort
   unreachable
  end
  local.get $this
  local.set $3
  global.get $~lib/memory/__stack_pointer
  local.get $3
  i32.store
  local.get $3
  call $~lib/arraybuffer/ArrayBufferView#get:dataStart
  local.get $index
  i32.const 2
  i32.shl
  i32.add
  local.get $value
  i32.store
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/typedarray/Uint32Array#__get (param $this i32) (param $index i32) (result i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $index
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/arraybuffer/ArrayBufferView#get:byteLength
  i32.const 2
  i32.shr_u
  i32.ge_u
  if
   i32.const 224
   i32.const 7456
   i32.const 878
   i32.const 64
   call $~lib/builtins/abort
   unreachable
  end
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/arraybuffer/ArrayBufferView#get:dataStart
  local.get $index
  i32.const 2
  i32.shl
  i32.add
  i32.load
  local.set $2
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $2
  return
 )
 (func $assembly/pdn_effects/oilPainting (param $srcPtr i32) (param $dstPtr i32) (param $w i32) (param $h i32) (param $brushSize i32) (param $coarseness i32) (param $startY i32) (param $endY i32)
  (local $arrayLen i32)
  (local $intensityCount i32)
  (local $avgR i32)
  (local $avgG i32)
  (local $avgB i32)
  (local $avgA i32)
  (local $y i32)
  (local $row i32)
  (local $value1 f64)
  (local $value2 f64)
  (local $top f64)
  (local $value1|19 f64)
  (local $value2|20 f64)
  (local $bottom f64)
  (local $x i32)
  (local $value1|23 f64)
  (local $value2|24 f64)
  (local $left f64)
  (local $value1|26 f64)
  (local $value2|27 f64)
  (local $right f64)
  (local $i i32)
  (local $j f64)
  (local $jRow i32)
  (local $i|32 f64)
  (local $idx i32)
  (local $r i32)
  (local $g i32)
  (local $b i32)
  (local $a i32)
  (local $r|38 i32)
  (local $g|39 i32)
  (local $b|40 i32)
  (local $maxIntensity i32)
  (local $intensity i32)
  (local $chosenIntensity i32)
  (local $maxInstance i32)
  (local $i|45 i32)
  (local $outIdx i32)
  (local $47 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 28
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.const 28
  memory.fill
  local.get $coarseness
  i32.const 1
  i32.add
  local.set $arrayLen
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  local.get $arrayLen
  call $~lib/typedarray/Int32Array#constructor
  local.tee $intensityCount
  i32.store
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  local.get $arrayLen
  call $~lib/typedarray/Uint32Array#constructor
  local.tee $avgR
  i32.store offset=4
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  local.get $arrayLen
  call $~lib/typedarray/Uint32Array#constructor
  local.tee $avgG
  i32.store offset=8
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  local.get $arrayLen
  call $~lib/typedarray/Uint32Array#constructor
  local.tee $avgB
  i32.store offset=12
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  local.get $arrayLen
  call $~lib/typedarray/Uint32Array#constructor
  local.tee $avgA
  i32.store offset=16
  local.get $startY
  local.set $y
  loop $for-loop|0
   local.get $y
   local.get $endY
   i32.lt_s
   if
    local.get $y
    local.get $w
    i32.mul
    i32.const 4
    i32.mul
    local.set $row
    block $~lib/math/NativeMath.max|inlined.12 (result f64)
     f64.const 0
     local.set $value1
     local.get $y
     local.get $brushSize
     i32.sub
     f64.convert_i32_s
     local.set $value2
     local.get $value1
     local.get $value2
     f64.max
     br $~lib/math/NativeMath.max|inlined.12
    end
    local.set $top
    block $~lib/math/NativeMath.min|inlined.10 (result f64)
     local.get $h
     f64.convert_i32_s
     local.set $value1|19
     local.get $y
     local.get $brushSize
     i32.add
     i32.const 1
     i32.add
     f64.convert_i32_s
     local.set $value2|20
     local.get $value1|19
     local.get $value2|20
     f64.min
     br $~lib/math/NativeMath.min|inlined.10
    end
    local.set $bottom
    i32.const 0
    local.set $x
    loop $for-loop|1
     local.get $x
     local.get $w
     i32.lt_s
     if
      block $~lib/math/NativeMath.max|inlined.13 (result f64)
       f64.const 0
       local.set $value1|23
       local.get $x
       local.get $brushSize
       i32.sub
       f64.convert_i32_s
       local.set $value2|24
       local.get $value1|23
       local.get $value2|24
       f64.max
       br $~lib/math/NativeMath.max|inlined.13
      end
      local.set $left
      block $~lib/math/NativeMath.min|inlined.11 (result f64)
       local.get $w
       f64.convert_i32_s
       local.set $value1|26
       local.get $x
       local.get $brushSize
       i32.add
       i32.const 1
       i32.add
       f64.convert_i32_s
       local.set $value2|27
       local.get $value1|26
       local.get $value2|27
       f64.min
       br $~lib/math/NativeMath.min|inlined.11
      end
      local.set $right
      i32.const 0
      local.set $i
      loop $for-loop|2
       local.get $i
       local.get $arrayLen
       i32.lt_s
       if
        local.get $intensityCount
        local.set $47
        global.get $~lib/memory/__stack_pointer
        local.get $47
        i32.store offset=20
        local.get $47
        local.get $i
        i32.const 0
        call $~lib/typedarray/Int32Array#__set
        local.get $avgR
        local.set $47
        global.get $~lib/memory/__stack_pointer
        local.get $47
        i32.store offset=20
        local.get $47
        local.get $i
        i32.const 0
        call $~lib/typedarray/Uint32Array#__set
        local.get $avgG
        local.set $47
        global.get $~lib/memory/__stack_pointer
        local.get $47
        i32.store offset=20
        local.get $47
        local.get $i
        i32.const 0
        call $~lib/typedarray/Uint32Array#__set
        local.get $avgB
        local.set $47
        global.get $~lib/memory/__stack_pointer
        local.get $47
        i32.store offset=20
        local.get $47
        local.get $i
        i32.const 0
        call $~lib/typedarray/Uint32Array#__set
        local.get $avgA
        local.set $47
        global.get $~lib/memory/__stack_pointer
        local.get $47
        i32.store offset=20
        local.get $47
        local.get $i
        i32.const 0
        call $~lib/typedarray/Uint32Array#__set
        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $for-loop|2
       end
      end
      local.get $top
      local.set $j
      loop $for-loop|3
       local.get $j
       local.get $bottom
       f64.lt
       if
        local.get $j
        i32.trunc_sat_f64_u
        local.get $w
        i32.mul
        i32.const 4
        i32.mul
        local.set $jRow
        local.get $left
        local.set $i|32
        loop $for-loop|4
         local.get $i|32
         local.get $right
         f64.lt
         if
          local.get $jRow
          local.get $i|32
          i32.trunc_sat_f64_u
          i32.const 2
          i32.shl
          i32.add
          local.set $idx
          local.get $srcPtr
          local.get $idx
          i32.add
          i32.load8_u
          local.set $r
          local.get $srcPtr
          local.get $idx
          i32.add
          i32.const 1
          i32.add
          i32.load8_u
          local.set $g
          local.get $srcPtr
          local.get $idx
          i32.add
          i32.const 2
          i32.add
          i32.load8_u
          local.set $b
          local.get $srcPtr
          local.get $idx
          i32.add
          i32.const 3
          i32.add
          i32.load8_u
          local.set $a
          block $assembly/pdn_effects/getIntensity|inlined.0 (result i32)
           local.get $r
           local.set $r|38
           local.get $g
           local.set $g|39
           local.get $b
           local.set $b|40
           local.get $coarseness
           local.set $maxIntensity
           local.get $r|38
           i32.const 77
           i32.mul
           local.get $g|39
           i32.const 150
           i32.mul
           i32.add
           local.get $b|40
           i32.const 29
           i32.mul
           i32.add
           i32.const 255
           i32.and
           f32.convert_i32_u
           f32.const 256
           f32.div
           local.get $maxIntensity
           f32.convert_i32_s
           f32.const 255
           f32.div
           f32.mul
           i32.trunc_sat_f32_s
           br $assembly/pdn_effects/getIntensity|inlined.0
          end
          local.set $intensity
          local.get $intensityCount
          local.set $47
          global.get $~lib/memory/__stack_pointer
          local.get $47
          i32.store offset=20
          local.get $47
          local.get $intensity
          local.get $intensityCount
          local.set $47
          global.get $~lib/memory/__stack_pointer
          local.get $47
          i32.store offset=24
          local.get $47
          local.get $intensity
          call $~lib/typedarray/Int32Array#__get
          i32.const 1
          i32.add
          call $~lib/typedarray/Int32Array#__set
          local.get $avgR
          local.set $47
          global.get $~lib/memory/__stack_pointer
          local.get $47
          i32.store offset=20
          local.get $47
          local.get $intensity
          local.get $avgR
          local.set $47
          global.get $~lib/memory/__stack_pointer
          local.get $47
          i32.store offset=24
          local.get $47
          local.get $intensity
          call $~lib/typedarray/Uint32Array#__get
          local.get $r
          i32.add
          call $~lib/typedarray/Uint32Array#__set
          local.get $avgG
          local.set $47
          global.get $~lib/memory/__stack_pointer
          local.get $47
          i32.store offset=20
          local.get $47
          local.get $intensity
          local.get $avgG
          local.set $47
          global.get $~lib/memory/__stack_pointer
          local.get $47
          i32.store offset=24
          local.get $47
          local.get $intensity
          call $~lib/typedarray/Uint32Array#__get
          local.get $g
          i32.add
          call $~lib/typedarray/Uint32Array#__set
          local.get $avgB
          local.set $47
          global.get $~lib/memory/__stack_pointer
          local.get $47
          i32.store offset=20
          local.get $47
          local.get $intensity
          local.get $avgB
          local.set $47
          global.get $~lib/memory/__stack_pointer
          local.get $47
          i32.store offset=24
          local.get $47
          local.get $intensity
          call $~lib/typedarray/Uint32Array#__get
          local.get $b
          i32.add
          call $~lib/typedarray/Uint32Array#__set
          local.get $avgA
          local.set $47
          global.get $~lib/memory/__stack_pointer
          local.get $47
          i32.store offset=20
          local.get $47
          local.get $intensity
          local.get $avgA
          local.set $47
          global.get $~lib/memory/__stack_pointer
          local.get $47
          i32.store offset=24
          local.get $47
          local.get $intensity
          call $~lib/typedarray/Uint32Array#__get
          local.get $a
          i32.add
          call $~lib/typedarray/Uint32Array#__set
          local.get $i|32
          f64.const 1
          f64.add
          local.set $i|32
          br $for-loop|4
         end
        end
        local.get $j
        f64.const 1
        f64.add
        local.set $j
        br $for-loop|3
       end
      end
      i32.const 0
      local.set $chosenIntensity
      i32.const 0
      local.set $maxInstance
      i32.const 0
      local.set $i|45
      loop $for-loop|5
       local.get $i|45
       local.get $coarseness
       i32.le_s
       if
        local.get $intensityCount
        local.set $47
        global.get $~lib/memory/__stack_pointer
        local.get $47
        i32.store offset=20
        local.get $47
        local.get $i|45
        call $~lib/typedarray/Int32Array#__get
        local.get $maxInstance
        i32.gt_s
        if
         local.get $i|45
         local.set $chosenIntensity
         local.get $intensityCount
         local.set $47
         global.get $~lib/memory/__stack_pointer
         local.get $47
         i32.store offset=20
         local.get $47
         local.get $i|45
         call $~lib/typedarray/Int32Array#__get
         local.set $maxInstance
        end
        local.get $i|45
        i32.const 1
        i32.add
        local.set $i|45
        br $for-loop|5
       end
      end
      local.get $row
      local.get $x
      i32.const 2
      i32.shl
      i32.add
      local.set $outIdx
      local.get $maxInstance
      i32.const 0
      i32.gt_s
      if
       local.get $dstPtr
       local.get $outIdx
       i32.add
       local.get $avgR
       local.set $47
       global.get $~lib/memory/__stack_pointer
       local.get $47
       i32.store offset=20
       local.get $47
       local.get $chosenIntensity
       call $~lib/typedarray/Uint32Array#__get
       local.get $maxInstance
       i32.div_u
       i32.store8
       local.get $dstPtr
       local.get $outIdx
       i32.add
       i32.const 1
       i32.add
       local.get $avgG
       local.set $47
       global.get $~lib/memory/__stack_pointer
       local.get $47
       i32.store offset=20
       local.get $47
       local.get $chosenIntensity
       call $~lib/typedarray/Uint32Array#__get
       local.get $maxInstance
       i32.div_u
       i32.store8
       local.get $dstPtr
       local.get $outIdx
       i32.add
       i32.const 2
       i32.add
       local.get $avgB
       local.set $47
       global.get $~lib/memory/__stack_pointer
       local.get $47
       i32.store offset=20
       local.get $47
       local.get $chosenIntensity
       call $~lib/typedarray/Uint32Array#__get
       local.get $maxInstance
       i32.div_u
       i32.store8
       local.get $dstPtr
       local.get $outIdx
       i32.add
       i32.const 3
       i32.add
       local.get $avgA
       local.set $47
       global.get $~lib/memory/__stack_pointer
       local.get $47
       i32.store offset=20
       local.get $47
       local.get $chosenIntensity
       call $~lib/typedarray/Uint32Array#__get
       local.get $maxInstance
       i32.div_u
       i32.store8
      else
       local.get $dstPtr
       local.get $outIdx
       i32.add
       local.get $srcPtr
       local.get $outIdx
       i32.add
       i32.load8_u
       i32.store8
       local.get $dstPtr
       local.get $outIdx
       i32.add
       i32.const 1
       i32.add
       local.get $srcPtr
       local.get $outIdx
       i32.add
       i32.const 1
       i32.add
       i32.load8_u
       i32.store8
       local.get $dstPtr
       local.get $outIdx
       i32.add
       i32.const 2
       i32.add
       local.get $srcPtr
       local.get $outIdx
       i32.add
       i32.const 2
       i32.add
       i32.load8_u
       i32.store8
       local.get $dstPtr
       local.get $outIdx
       i32.add
       i32.const 3
       i32.add
       local.get $srcPtr
       local.get $outIdx
       i32.add
       i32.const 3
       i32.add
       i32.load8_u
       i32.store8
      end
      local.get $x
      i32.const 1
      i32.add
      local.set $x
      br $for-loop|1
     end
    end
    local.get $y
    i32.const 1
    i32.add
    local.set $y
    br $for-loop|0
   end
  end
  global.get $~lib/memory/__stack_pointer
  i32.const 28
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/array/Array<i32>#__visit (param $this i32) (param $cookie i32)
  (local $2 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  i32.const 0
  drop
  local.get $this
  local.set $2
  global.get $~lib/memory/__stack_pointer
  local.get $2
  i32.store
  local.get $2
  call $~lib/array/Array<i32>#get:buffer
  local.get $cookie
  call $~lib/rt/itcms/__visit
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/array/Array<~lib/array/Array<i32>>#__visit (param $this i32) (param $cookie i32)
  (local $cur i32)
  (local $end i32)
  (local $val i32)
  (local $5 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  i32.const 1
  drop
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store
  local.get $5
  call $~lib/array/Array<~lib/array/Array<i32>>#get:dataStart
  local.set $cur
  local.get $cur
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store
  local.get $5
  call $~lib/array/Array<~lib/array/Array<i32>>#get:length_
  i32.const 2
  i32.shl
  i32.add
  local.set $end
  loop $while-continue|0
   local.get $cur
   local.get $end
   i32.lt_u
   if
    local.get $cur
    i32.load
    local.set $val
    local.get $val
    if
     local.get $val
     local.get $cookie
     call $~lib/rt/itcms/__visit
    end
    local.get $cur
    i32.const 4
    i32.add
    local.set $cur
    br $while-continue|0
   end
  end
  local.get $this
  local.set $5
  global.get $~lib/memory/__stack_pointer
  local.get $5
  i32.store
  local.get $5
  call $~lib/array/Array<~lib/array/Array<i32>>#get:buffer
  local.get $cookie
  call $~lib/rt/itcms/__visit
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
 )
 (func $~lib/object/Object#constructor (param $this i32) (result i32)
  (local $1 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $this
  i32.eqz
  if
   global.get $~lib/memory/__stack_pointer
   i32.const 0
   i32.const 0
   call $~lib/rt/itcms/__new
   local.tee $this
   i32.store
  end
  local.get $this
  local.set $1
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $1
 )
 (func $~lib/rt/__newArray (param $length i32) (param $alignLog2 i32) (param $id i32) (param $data i32) (result i32)
  (local $bufferSize i32)
  (local $buffer i32)
  (local $array i32)
  (local $7 i32)
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.sub
  global.set $~lib/memory/__stack_pointer
  call $~stack_check
  global.get $~lib/memory/__stack_pointer
  i32.const 0
  i32.store
  local.get $length
  local.get $alignLog2
  i32.shl
  local.set $bufferSize
  global.get $~lib/memory/__stack_pointer
  local.get $bufferSize
  i32.const 1
  local.get $data
  call $~lib/rt/__newBuffer
  local.tee $buffer
  i32.store
  i32.const 16
  local.get $id
  call $~lib/rt/itcms/__new
  local.set $array
  local.get $array
  local.get $buffer
  i32.store
  local.get $array
  local.get $buffer
  i32.const 0
  call $~lib/rt/itcms/__link
  local.get $array
  local.get $buffer
  i32.store offset=4
  local.get $array
  local.get $bufferSize
  i32.store offset=8
  local.get $array
  local.get $length
  i32.store offset=12
  local.get $array
  local.set $7
  global.get $~lib/memory/__stack_pointer
  i32.const 4
  i32.add
  global.set $~lib/memory/__stack_pointer
  local.get $7
  return
 )
)
