"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/adler32.js
var require_adler32 = __commonJS({
  "../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/adler32.js"(exports2, module2) {
    "use strict";
    var adler32 = (adler, buf, len, pos) => {
      let s1 = adler & 65535 | 0, s2 = adler >>> 16 & 65535 | 0, n = 0;
      while (len !== 0) {
        n = len > 2e3 ? 2e3 : len;
        len -= n;
        do {
          s1 = s1 + buf[pos++] | 0;
          s2 = s2 + s1 | 0;
        } while (--n);
        s1 %= 65521;
        s2 %= 65521;
      }
      return s1 | s2 << 16 | 0;
    };
    module2.exports = adler32;
  }
});

// ../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/crc32.js
var require_crc32 = __commonJS({
  "../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/crc32.js"(exports2, module2) {
    "use strict";
    var makeTable = () => {
      let c, table = [];
      for (var n = 0; n < 256; n++) {
        c = n;
        for (var k = 0; k < 8; k++) {
          c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
        }
        table[n] = c;
      }
      return table;
    };
    var crcTable3 = new Uint32Array(makeTable());
    var crc32 = (crc3, buf, len, pos) => {
      const t = crcTable3;
      const end = pos + len;
      crc3 ^= -1;
      for (let i2 = pos; i2 < end; i2++) {
        crc3 = crc3 >>> 8 ^ t[(crc3 ^ buf[i2]) & 255];
      }
      return crc3 ^ -1;
    };
    module2.exports = crc32;
  }
});

// ../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/inffast.js
var require_inffast = __commonJS({
  "../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/inffast.js"(exports2, module2) {
    "use strict";
    var BAD = 16209;
    var TYPE = 16191;
    module2.exports = function inflate_fast(strm, start) {
      let _in;
      let last;
      let _out;
      let beg;
      let end;
      let dmax;
      let wsize;
      let whave;
      let wnext;
      let s_window;
      let hold;
      let bits2;
      let lcode;
      let dcode;
      let lmask;
      let dmask;
      let here;
      let op;
      let len;
      let dist;
      let from;
      let from_source;
      let input, output;
      const state = strm.state;
      _in = strm.next_in;
      input = strm.input;
      last = _in + (strm.avail_in - 5);
      _out = strm.next_out;
      output = strm.output;
      beg = _out - (start - strm.avail_out);
      end = _out + (strm.avail_out - 257);
      dmax = state.dmax;
      wsize = state.wsize;
      whave = state.whave;
      wnext = state.wnext;
      s_window = state.window;
      hold = state.hold;
      bits2 = state.bits;
      lcode = state.lencode;
      dcode = state.distcode;
      lmask = (1 << state.lenbits) - 1;
      dmask = (1 << state.distbits) - 1;
      top:
        do {
          if (bits2 < 15) {
            hold += input[_in++] << bits2;
            bits2 += 8;
            hold += input[_in++] << bits2;
            bits2 += 8;
          }
          here = lcode[hold & lmask];
          dolen:
            for (; ; ) {
              op = here >>> 24;
              hold >>>= op;
              bits2 -= op;
              op = here >>> 16 & 255;
              if (op === 0) {
                output[_out++] = here & 65535;
              } else if (op & 16) {
                len = here & 65535;
                op &= 15;
                if (op) {
                  if (bits2 < op) {
                    hold += input[_in++] << bits2;
                    bits2 += 8;
                  }
                  len += hold & (1 << op) - 1;
                  hold >>>= op;
                  bits2 -= op;
                }
                if (bits2 < 15) {
                  hold += input[_in++] << bits2;
                  bits2 += 8;
                  hold += input[_in++] << bits2;
                  bits2 += 8;
                }
                here = dcode[hold & dmask];
                dodist:
                  for (; ; ) {
                    op = here >>> 24;
                    hold >>>= op;
                    bits2 -= op;
                    op = here >>> 16 & 255;
                    if (op & 16) {
                      dist = here & 65535;
                      op &= 15;
                      if (bits2 < op) {
                        hold += input[_in++] << bits2;
                        bits2 += 8;
                        if (bits2 < op) {
                          hold += input[_in++] << bits2;
                          bits2 += 8;
                        }
                      }
                      dist += hold & (1 << op) - 1;
                      if (dist > dmax) {
                        strm.msg = "invalid distance too far back";
                        state.mode = BAD;
                        break top;
                      }
                      hold >>>= op;
                      bits2 -= op;
                      op = _out - beg;
                      if (dist > op) {
                        op = dist - op;
                        if (op > whave) {
                          if (state.sane) {
                            strm.msg = "invalid distance too far back";
                            state.mode = BAD;
                            break top;
                          }
                        }
                        from = 0;
                        from_source = s_window;
                        if (wnext === 0) {
                          from += wsize - op;
                          if (op < len) {
                            len -= op;
                            do {
                              output[_out++] = s_window[from++];
                            } while (--op);
                            from = _out - dist;
                            from_source = output;
                          }
                        } else if (wnext < op) {
                          from += wsize + wnext - op;
                          op -= wnext;
                          if (op < len) {
                            len -= op;
                            do {
                              output[_out++] = s_window[from++];
                            } while (--op);
                            from = 0;
                            if (wnext < len) {
                              op = wnext;
                              len -= op;
                              do {
                                output[_out++] = s_window[from++];
                              } while (--op);
                              from = _out - dist;
                              from_source = output;
                            }
                          }
                        } else {
                          from += wnext - op;
                          if (op < len) {
                            len -= op;
                            do {
                              output[_out++] = s_window[from++];
                            } while (--op);
                            from = _out - dist;
                            from_source = output;
                          }
                        }
                        while (len > 2) {
                          output[_out++] = from_source[from++];
                          output[_out++] = from_source[from++];
                          output[_out++] = from_source[from++];
                          len -= 3;
                        }
                        if (len) {
                          output[_out++] = from_source[from++];
                          if (len > 1) {
                            output[_out++] = from_source[from++];
                          }
                        }
                      } else {
                        from = _out - dist;
                        do {
                          output[_out++] = output[from++];
                          output[_out++] = output[from++];
                          output[_out++] = output[from++];
                          len -= 3;
                        } while (len > 2);
                        if (len) {
                          output[_out++] = output[from++];
                          if (len > 1) {
                            output[_out++] = output[from++];
                          }
                        }
                      }
                    } else if ((op & 64) === 0) {
                      here = dcode[(here & 65535) + (hold & (1 << op) - 1)];
                      continue dodist;
                    } else {
                      strm.msg = "invalid distance code";
                      state.mode = BAD;
                      break top;
                    }
                    break;
                  }
              } else if ((op & 64) === 0) {
                here = lcode[(here & 65535) + (hold & (1 << op) - 1)];
                continue dolen;
              } else if (op & 32) {
                state.mode = TYPE;
                break top;
              } else {
                strm.msg = "invalid literal/length code";
                state.mode = BAD;
                break top;
              }
              break;
            }
        } while (_in < last && _out < end);
      len = bits2 >> 3;
      _in -= len;
      bits2 -= len << 3;
      hold &= (1 << bits2) - 1;
      strm.next_in = _in;
      strm.next_out = _out;
      strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last);
      strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end);
      state.hold = hold;
      state.bits = bits2;
      return;
    };
  }
});

// ../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/inftrees.js
var require_inftrees = __commonJS({
  "../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/inftrees.js"(exports2, module2) {
    "use strict";
    var MAXBITS = 15;
    var ENOUGH_LENS = 852;
    var ENOUGH_DISTS = 592;
    var CODES = 0;
    var LENS = 1;
    var DISTS = 2;
    var lbase = new Uint16Array([
      /* Length codes 257..285 base */
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      13,
      15,
      17,
      19,
      23,
      27,
      31,
      35,
      43,
      51,
      59,
      67,
      83,
      99,
      115,
      131,
      163,
      195,
      227,
      258,
      0,
      0
    ]);
    var lext = new Uint8Array([
      /* Length codes 257..285 extra */
      16,
      16,
      16,
      16,
      16,
      16,
      16,
      16,
      17,
      17,
      17,
      17,
      18,
      18,
      18,
      18,
      19,
      19,
      19,
      19,
      20,
      20,
      20,
      20,
      21,
      21,
      21,
      21,
      16,
      72,
      78
    ]);
    var dbase = new Uint16Array([
      /* Distance codes 0..29 base */
      1,
      2,
      3,
      4,
      5,
      7,
      9,
      13,
      17,
      25,
      33,
      49,
      65,
      97,
      129,
      193,
      257,
      385,
      513,
      769,
      1025,
      1537,
      2049,
      3073,
      4097,
      6145,
      8193,
      12289,
      16385,
      24577,
      0,
      0
    ]);
    var dext = new Uint8Array([
      /* Distance codes 0..29 extra */
      16,
      16,
      16,
      16,
      17,
      17,
      18,
      18,
      19,
      19,
      20,
      20,
      21,
      21,
      22,
      22,
      23,
      23,
      24,
      24,
      25,
      25,
      26,
      26,
      27,
      27,
      28,
      28,
      29,
      29,
      64,
      64
    ]);
    var inflate_table = (type, lens, lens_index, codes, table, table_index, work, opts) => {
      const bits2 = opts.bits;
      let len = 0;
      let sym = 0;
      let min = 0, max2 = 0;
      let root = 0;
      let curr = 0;
      let drop = 0;
      let left = 0;
      let used = 0;
      let huff = 0;
      let incr;
      let fill;
      let low;
      let mask;
      let next;
      let base = null;
      let match;
      const count = new Uint16Array(MAXBITS + 1);
      const offs = new Uint16Array(MAXBITS + 1);
      let extra = null;
      let here_bits, here_op, here_val;
      for (len = 0; len <= MAXBITS; len++) {
        count[len] = 0;
      }
      for (sym = 0; sym < codes; sym++) {
        count[lens[lens_index + sym]]++;
      }
      root = bits2;
      for (max2 = MAXBITS; max2 >= 1; max2--) {
        if (count[max2] !== 0) {
          break;
        }
      }
      if (root > max2) {
        root = max2;
      }
      if (max2 === 0) {
        table[table_index++] = 1 << 24 | 64 << 16 | 0;
        table[table_index++] = 1 << 24 | 64 << 16 | 0;
        opts.bits = 1;
        return 0;
      }
      for (min = 1; min < max2; min++) {
        if (count[min] !== 0) {
          break;
        }
      }
      if (root < min) {
        root = min;
      }
      left = 1;
      for (len = 1; len <= MAXBITS; len++) {
        left <<= 1;
        left -= count[len];
        if (left < 0) {
          return -1;
        }
      }
      if (left > 0 && (type === CODES || max2 !== 1)) {
        return -1;
      }
      offs[1] = 0;
      for (len = 1; len < MAXBITS; len++) {
        offs[len + 1] = offs[len] + count[len];
      }
      for (sym = 0; sym < codes; sym++) {
        if (lens[lens_index + sym] !== 0) {
          work[offs[lens[lens_index + sym]]++] = sym;
        }
      }
      if (type === CODES) {
        base = extra = work;
        match = 20;
      } else if (type === LENS) {
        base = lbase;
        extra = lext;
        match = 257;
      } else {
        base = dbase;
        extra = dext;
        match = 0;
      }
      huff = 0;
      sym = 0;
      len = min;
      next = table_index;
      curr = root;
      drop = 0;
      low = -1;
      used = 1 << root;
      mask = used - 1;
      if (type === LENS && used > ENOUGH_LENS || type === DISTS && used > ENOUGH_DISTS) {
        return 1;
      }
      for (; ; ) {
        here_bits = len - drop;
        if (work[sym] + 1 < match) {
          here_op = 0;
          here_val = work[sym];
        } else if (work[sym] >= match) {
          here_op = extra[work[sym] - match];
          here_val = base[work[sym] - match];
        } else {
          here_op = 32 + 64;
          here_val = 0;
        }
        incr = 1 << len - drop;
        fill = 1 << curr;
        min = fill;
        do {
          fill -= incr;
          table[next + (huff >> drop) + fill] = here_bits << 24 | here_op << 16 | here_val | 0;
        } while (fill !== 0);
        incr = 1 << len - 1;
        while (huff & incr) {
          incr >>= 1;
        }
        if (incr !== 0) {
          huff &= incr - 1;
          huff += incr;
        } else {
          huff = 0;
        }
        sym++;
        if (--count[len] === 0) {
          if (len === max2) {
            break;
          }
          len = lens[lens_index + work[sym]];
        }
        if (len > root && (huff & mask) !== low) {
          if (drop === 0) {
            drop = root;
          }
          next += min;
          curr = len - drop;
          left = 1 << curr;
          while (curr + drop < max2) {
            left -= count[curr + drop];
            if (left <= 0) {
              break;
            }
            curr++;
            left <<= 1;
          }
          used += 1 << curr;
          if (type === LENS && used > ENOUGH_LENS || type === DISTS && used > ENOUGH_DISTS) {
            return 1;
          }
          low = huff & mask;
          table[low] = root << 24 | curr << 16 | next - table_index | 0;
        }
      }
      if (huff !== 0) {
        table[next + huff] = len - drop << 24 | 64 << 16 | 0;
      }
      opts.bits = root;
      return 0;
    };
    module2.exports = inflate_table;
  }
});

// ../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/constants.js
var require_constants = __commonJS({
  "../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/constants.js"(exports2, module2) {
    "use strict";
    module2.exports = {
      /* Allowed flush values; see deflate() and inflate() below for details */
      Z_NO_FLUSH: 0,
      Z_PARTIAL_FLUSH: 1,
      Z_SYNC_FLUSH: 2,
      Z_FULL_FLUSH: 3,
      Z_FINISH: 4,
      Z_BLOCK: 5,
      Z_TREES: 6,
      /* Return codes for the compression/decompression functions. Negative values
      * are errors, positive values are used for special but normal events.
      */
      Z_OK: 0,
      Z_STREAM_END: 1,
      Z_NEED_DICT: 2,
      Z_ERRNO: -1,
      Z_STREAM_ERROR: -2,
      Z_DATA_ERROR: -3,
      Z_MEM_ERROR: -4,
      Z_BUF_ERROR: -5,
      //Z_VERSION_ERROR: -6,
      /* compression levels */
      Z_NO_COMPRESSION: 0,
      Z_BEST_SPEED: 1,
      Z_BEST_COMPRESSION: 9,
      Z_DEFAULT_COMPRESSION: -1,
      Z_FILTERED: 1,
      Z_HUFFMAN_ONLY: 2,
      Z_RLE: 3,
      Z_FIXED: 4,
      Z_DEFAULT_STRATEGY: 0,
      /* Possible values of the data_type field (though see inflate()) */
      Z_BINARY: 0,
      Z_TEXT: 1,
      //Z_ASCII:                1, // = Z_TEXT (deprecated)
      Z_UNKNOWN: 2,
      /* The deflate compression method */
      Z_DEFLATED: 8
      //Z_NULL:                 null // Use -1 or null inline, depending on var type
    };
  }
});

// ../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/inflate.js
var require_inflate = __commonJS({
  "../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/inflate.js"(exports2, module2) {
    "use strict";
    var adler32 = require_adler32();
    var crc32 = require_crc32();
    var inflate_fast = require_inffast();
    var inflate_table = require_inftrees();
    var CODES = 0;
    var LENS = 1;
    var DISTS = 2;
    var {
      Z_FINISH,
      Z_BLOCK,
      Z_TREES,
      Z_OK,
      Z_STREAM_END,
      Z_NEED_DICT,
      Z_STREAM_ERROR,
      Z_DATA_ERROR,
      Z_MEM_ERROR,
      Z_BUF_ERROR,
      Z_DEFLATED
    } = require_constants();
    var HEAD = 16180;
    var FLAGS = 16181;
    var TIME = 16182;
    var OS = 16183;
    var EXLEN = 16184;
    var EXTRA = 16185;
    var NAME = 16186;
    var COMMENT = 16187;
    var HCRC = 16188;
    var DICTID = 16189;
    var DICT = 16190;
    var TYPE = 16191;
    var TYPEDO = 16192;
    var STORED = 16193;
    var COPY_ = 16194;
    var COPY = 16195;
    var TABLE = 16196;
    var LENLENS = 16197;
    var CODELENS = 16198;
    var LEN_ = 16199;
    var LEN = 16200;
    var LENEXT = 16201;
    var DIST = 16202;
    var DISTEXT = 16203;
    var MATCH = 16204;
    var LIT = 16205;
    var CHECK = 16206;
    var LENGTH = 16207;
    var DONE = 16208;
    var BAD = 16209;
    var MEM = 16210;
    var SYNC = 16211;
    var ENOUGH_LENS = 852;
    var ENOUGH_DISTS = 592;
    var MAX_WBITS = 15;
    var DEF_WBITS = MAX_WBITS;
    var zswap32 = (q) => {
      return (q >>> 24 & 255) + (q >>> 8 & 65280) + ((q & 65280) << 8) + ((q & 255) << 24);
    };
    function InflateState() {
      this.strm = null;
      this.mode = 0;
      this.last = false;
      this.wrap = 0;
      this.havedict = false;
      this.flags = 0;
      this.dmax = 0;
      this.check = 0;
      this.total = 0;
      this.head = null;
      this.wbits = 0;
      this.wsize = 0;
      this.whave = 0;
      this.wnext = 0;
      this.window = null;
      this.hold = 0;
      this.bits = 0;
      this.length = 0;
      this.offset = 0;
      this.extra = 0;
      this.lencode = null;
      this.distcode = null;
      this.lenbits = 0;
      this.distbits = 0;
      this.ncode = 0;
      this.nlen = 0;
      this.ndist = 0;
      this.have = 0;
      this.next = null;
      this.lens = new Uint16Array(320);
      this.work = new Uint16Array(288);
      this.lendyn = null;
      this.distdyn = null;
      this.sane = 0;
      this.back = 0;
      this.was = 0;
    }
    var inflateStateCheck = (strm) => {
      if (!strm) {
        return 1;
      }
      const state = strm.state;
      if (!state || state.strm !== strm || state.mode < HEAD || state.mode > SYNC) {
        return 1;
      }
      return 0;
    };
    var inflateResetKeep = (strm) => {
      if (inflateStateCheck(strm)) {
        return Z_STREAM_ERROR;
      }
      const state = strm.state;
      strm.total_in = strm.total_out = state.total = 0;
      strm.msg = "";
      if (state.wrap) {
        strm.adler = state.wrap & 1;
      }
      state.mode = HEAD;
      state.last = 0;
      state.havedict = 0;
      state.flags = -1;
      state.dmax = 32768;
      state.head = null;
      state.hold = 0;
      state.bits = 0;
      state.lencode = state.lendyn = new Int32Array(ENOUGH_LENS);
      state.distcode = state.distdyn = new Int32Array(ENOUGH_DISTS);
      state.sane = 1;
      state.back = -1;
      return Z_OK;
    };
    var inflateReset = (strm) => {
      if (inflateStateCheck(strm)) {
        return Z_STREAM_ERROR;
      }
      const state = strm.state;
      state.wsize = 0;
      state.whave = 0;
      state.wnext = 0;
      return inflateResetKeep(strm);
    };
    var inflateReset2 = (strm, windowBits) => {
      let wrap;
      if (inflateStateCheck(strm)) {
        return Z_STREAM_ERROR;
      }
      const state = strm.state;
      if (windowBits < 0) {
        wrap = 0;
        windowBits = -windowBits;
      } else {
        wrap = (windowBits >> 4) + 5;
        if (windowBits < 48) {
          windowBits &= 15;
        }
      }
      if (windowBits && (windowBits < 8 || windowBits > 15)) {
        return Z_STREAM_ERROR;
      }
      if (state.window !== null && state.wbits !== windowBits) {
        state.window = null;
      }
      state.wrap = wrap;
      state.wbits = windowBits;
      return inflateReset(strm);
    };
    var inflateInit2 = (strm, windowBits) => {
      if (!strm) {
        return Z_STREAM_ERROR;
      }
      const state = new InflateState();
      strm.state = state;
      state.strm = strm;
      state.window = null;
      state.mode = HEAD;
      const ret = inflateReset2(strm, windowBits);
      if (ret !== Z_OK) {
        strm.state = null;
      }
      return ret;
    };
    var inflateInit = (strm) => {
      return inflateInit2(strm, DEF_WBITS);
    };
    var virgin = true;
    var lenfix;
    var distfix;
    var fixedtables = (state) => {
      if (virgin) {
        lenfix = new Int32Array(512);
        distfix = new Int32Array(32);
        let sym = 0;
        while (sym < 144) {
          state.lens[sym++] = 8;
        }
        while (sym < 256) {
          state.lens[sym++] = 9;
        }
        while (sym < 280) {
          state.lens[sym++] = 7;
        }
        while (sym < 288) {
          state.lens[sym++] = 8;
        }
        inflate_table(LENS, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 });
        sym = 0;
        while (sym < 32) {
          state.lens[sym++] = 5;
        }
        inflate_table(DISTS, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 });
        virgin = false;
      }
      state.lencode = lenfix;
      state.lenbits = 9;
      state.distcode = distfix;
      state.distbits = 5;
    };
    var updatewindow = (strm, src, end, copy) => {
      let dist;
      const state = strm.state;
      if (state.window === null) {
        state.wsize = 1 << state.wbits;
        state.wnext = 0;
        state.whave = 0;
        state.window = new Uint8Array(state.wsize);
      }
      if (copy >= state.wsize) {
        state.window.set(src.subarray(end - state.wsize, end), 0);
        state.wnext = 0;
        state.whave = state.wsize;
      } else {
        dist = state.wsize - state.wnext;
        if (dist > copy) {
          dist = copy;
        }
        state.window.set(src.subarray(end - copy, end - copy + dist), state.wnext);
        copy -= dist;
        if (copy) {
          state.window.set(src.subarray(end - copy, end), 0);
          state.wnext = copy;
          state.whave = state.wsize;
        } else {
          state.wnext += dist;
          if (state.wnext === state.wsize) {
            state.wnext = 0;
          }
          if (state.whave < state.wsize) {
            state.whave += dist;
          }
        }
      }
      return 0;
    };
    var inflate = (strm, flush) => {
      let state;
      let input, output;
      let next;
      let put;
      let have, left;
      let hold;
      let bits2;
      let _in, _out;
      let copy;
      let from;
      let from_source;
      let here = 0;
      let here_bits, here_op, here_val;
      let last_bits, last_op, last_val;
      let len;
      let ret;
      const hbuf = new Uint8Array(4);
      let opts;
      let n;
      const order = (
        /* permutation of code lengths */
        new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15])
      );
      if (inflateStateCheck(strm) || !strm.output || !strm.input && strm.avail_in !== 0) {
        return Z_STREAM_ERROR;
      }
      state = strm.state;
      if (state.mode === TYPE) {
        state.mode = TYPEDO;
      }
      put = strm.next_out;
      output = strm.output;
      left = strm.avail_out;
      next = strm.next_in;
      input = strm.input;
      have = strm.avail_in;
      hold = state.hold;
      bits2 = state.bits;
      _in = have;
      _out = left;
      ret = Z_OK;
      inf_leave:
        for (; ; ) {
          switch (state.mode) {
            case HEAD:
              if (state.wrap === 0) {
                state.mode = TYPEDO;
                break;
              }
              while (bits2 < 16) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits2;
                bits2 += 8;
              }
              if (state.wrap & 2 && hold === 35615) {
                if (state.wbits === 0) {
                  state.wbits = 15;
                }
                state.check = 0;
                hbuf[0] = hold & 255;
                hbuf[1] = hold >>> 8 & 255;
                state.check = crc32(state.check, hbuf, 2, 0);
                hold = 0;
                bits2 = 0;
                state.mode = FLAGS;
                break;
              }
              if (state.head) {
                state.head.done = false;
              }
              if (!(state.wrap & 1) || /* check if zlib header allowed */
              (((hold & 255) << 8) + (hold >> 8)) % 31) {
                strm.msg = "incorrect header check";
                state.mode = BAD;
                break;
              }
              if ((hold & 15) !== Z_DEFLATED) {
                strm.msg = "unknown compression method";
                state.mode = BAD;
                break;
              }
              hold >>>= 4;
              bits2 -= 4;
              len = (hold & 15) + 8;
              if (state.wbits === 0) {
                state.wbits = len;
              }
              if (len > 15 || len > state.wbits) {
                strm.msg = "invalid window size";
                state.mode = BAD;
                break;
              }
              state.dmax = 1 << state.wbits;
              state.flags = 0;
              strm.adler = state.check = 1;
              state.mode = hold & 512 ? DICTID : TYPE;
              hold = 0;
              bits2 = 0;
              break;
            case FLAGS:
              while (bits2 < 16) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits2;
                bits2 += 8;
              }
              state.flags = hold;
              if ((state.flags & 255) !== Z_DEFLATED) {
                strm.msg = "unknown compression method";
                state.mode = BAD;
                break;
              }
              if (state.flags & 57344) {
                strm.msg = "unknown header flags set";
                state.mode = BAD;
                break;
              }
              if (state.head) {
                state.head.text = hold >> 8 & 1;
              }
              if (state.flags & 512 && state.wrap & 4) {
                hbuf[0] = hold & 255;
                hbuf[1] = hold >>> 8 & 255;
                state.check = crc32(state.check, hbuf, 2, 0);
              }
              hold = 0;
              bits2 = 0;
              state.mode = TIME;
            /* falls through */
            case TIME:
              while (bits2 < 32) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits2;
                bits2 += 8;
              }
              if (state.head) {
                state.head.time = hold;
              }
              if (state.flags & 512 && state.wrap & 4) {
                hbuf[0] = hold & 255;
                hbuf[1] = hold >>> 8 & 255;
                hbuf[2] = hold >>> 16 & 255;
                hbuf[3] = hold >>> 24 & 255;
                state.check = crc32(state.check, hbuf, 4, 0);
              }
              hold = 0;
              bits2 = 0;
              state.mode = OS;
            /* falls through */
            case OS:
              while (bits2 < 16) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits2;
                bits2 += 8;
              }
              if (state.head) {
                state.head.xflags = hold & 255;
                state.head.os = hold >> 8;
              }
              if (state.flags & 512 && state.wrap & 4) {
                hbuf[0] = hold & 255;
                hbuf[1] = hold >>> 8 & 255;
                state.check = crc32(state.check, hbuf, 2, 0);
              }
              hold = 0;
              bits2 = 0;
              state.mode = EXLEN;
            /* falls through */
            case EXLEN:
              if (state.flags & 1024) {
                while (bits2 < 16) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits2;
                  bits2 += 8;
                }
                state.length = hold;
                if (state.head) {
                  state.head.extra_len = hold;
                }
                if (state.flags & 512 && state.wrap & 4) {
                  hbuf[0] = hold & 255;
                  hbuf[1] = hold >>> 8 & 255;
                  state.check = crc32(state.check, hbuf, 2, 0);
                }
                hold = 0;
                bits2 = 0;
              } else if (state.head) {
                state.head.extra = null;
              }
              state.mode = EXTRA;
            /* falls through */
            case EXTRA:
              if (state.flags & 1024) {
                copy = state.length;
                if (copy > have) {
                  copy = have;
                }
                if (copy) {
                  if (state.head) {
                    len = state.head.extra_len - state.length;
                    if (!state.head.extra) {
                      state.head.extra = new Uint8Array(state.head.extra_len);
                    }
                    state.head.extra.set(
                      input.subarray(
                        next,
                        // extra field is limited to 65536 bytes
                        // - no need for additional size check
                        next + copy
                      ),
                      /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                      len
                    );
                  }
                  if (state.flags & 512 && state.wrap & 4) {
                    state.check = crc32(state.check, input, copy, next);
                  }
                  have -= copy;
                  next += copy;
                  state.length -= copy;
                }
                if (state.length) {
                  break inf_leave;
                }
              }
              state.length = 0;
              state.mode = NAME;
            /* falls through */
            case NAME:
              if (state.flags & 2048) {
                if (have === 0) {
                  break inf_leave;
                }
                copy = 0;
                do {
                  len = input[next + copy++];
                  if (state.head && len && state.length < 65536) {
                    state.head.name += String.fromCharCode(len);
                  }
                } while (len && copy < have);
                if (state.flags & 512 && state.wrap & 4) {
                  state.check = crc32(state.check, input, copy, next);
                }
                have -= copy;
                next += copy;
                if (len) {
                  break inf_leave;
                }
              } else if (state.head) {
                state.head.name = null;
              }
              state.length = 0;
              state.mode = COMMENT;
            /* falls through */
            case COMMENT:
              if (state.flags & 4096) {
                if (have === 0) {
                  break inf_leave;
                }
                copy = 0;
                do {
                  len = input[next + copy++];
                  if (state.head && len && state.length < 65536) {
                    state.head.comment += String.fromCharCode(len);
                  }
                } while (len && copy < have);
                if (state.flags & 512 && state.wrap & 4) {
                  state.check = crc32(state.check, input, copy, next);
                }
                have -= copy;
                next += copy;
                if (len) {
                  break inf_leave;
                }
              } else if (state.head) {
                state.head.comment = null;
              }
              state.mode = HCRC;
            /* falls through */
            case HCRC:
              if (state.flags & 512) {
                while (bits2 < 16) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits2;
                  bits2 += 8;
                }
                if (state.wrap & 4 && hold !== (state.check & 65535)) {
                  strm.msg = "header crc mismatch";
                  state.mode = BAD;
                  break;
                }
                hold = 0;
                bits2 = 0;
              }
              if (state.head) {
                state.head.hcrc = state.flags >> 9 & 1;
                state.head.done = true;
              }
              strm.adler = state.check = 0;
              state.mode = TYPE;
              break;
            case DICTID:
              while (bits2 < 32) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits2;
                bits2 += 8;
              }
              strm.adler = state.check = zswap32(hold);
              hold = 0;
              bits2 = 0;
              state.mode = DICT;
            /* falls through */
            case DICT:
              if (state.havedict === 0) {
                strm.next_out = put;
                strm.avail_out = left;
                strm.next_in = next;
                strm.avail_in = have;
                state.hold = hold;
                state.bits = bits2;
                return Z_NEED_DICT;
              }
              strm.adler = state.check = 1;
              state.mode = TYPE;
            /* falls through */
            case TYPE:
              if (flush === Z_BLOCK || flush === Z_TREES) {
                break inf_leave;
              }
            /* falls through */
            case TYPEDO:
              if (state.last) {
                hold >>>= bits2 & 7;
                bits2 -= bits2 & 7;
                state.mode = CHECK;
                break;
              }
              while (bits2 < 3) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits2;
                bits2 += 8;
              }
              state.last = hold & 1;
              hold >>>= 1;
              bits2 -= 1;
              switch (hold & 3) {
                case 0:
                  state.mode = STORED;
                  break;
                case 1:
                  fixedtables(state);
                  state.mode = LEN_;
                  if (flush === Z_TREES) {
                    hold >>>= 2;
                    bits2 -= 2;
                    break inf_leave;
                  }
                  break;
                case 2:
                  state.mode = TABLE;
                  break;
                case 3:
                  strm.msg = "invalid block type";
                  state.mode = BAD;
              }
              hold >>>= 2;
              bits2 -= 2;
              break;
            case STORED:
              hold >>>= bits2 & 7;
              bits2 -= bits2 & 7;
              while (bits2 < 32) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits2;
                bits2 += 8;
              }
              if ((hold & 65535) !== (hold >>> 16 ^ 65535)) {
                strm.msg = "invalid stored block lengths";
                state.mode = BAD;
                break;
              }
              state.length = hold & 65535;
              hold = 0;
              bits2 = 0;
              state.mode = COPY_;
              if (flush === Z_TREES) {
                break inf_leave;
              }
            /* falls through */
            case COPY_:
              state.mode = COPY;
            /* falls through */
            case COPY:
              copy = state.length;
              if (copy) {
                if (copy > have) {
                  copy = have;
                }
                if (copy > left) {
                  copy = left;
                }
                if (copy === 0) {
                  break inf_leave;
                }
                output.set(input.subarray(next, next + copy), put);
                have -= copy;
                next += copy;
                left -= copy;
                put += copy;
                state.length -= copy;
                break;
              }
              state.mode = TYPE;
              break;
            case TABLE:
              while (bits2 < 14) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits2;
                bits2 += 8;
              }
              state.nlen = (hold & 31) + 257;
              hold >>>= 5;
              bits2 -= 5;
              state.ndist = (hold & 31) + 1;
              hold >>>= 5;
              bits2 -= 5;
              state.ncode = (hold & 15) + 4;
              hold >>>= 4;
              bits2 -= 4;
              if (state.nlen > 286 || state.ndist > 30) {
                strm.msg = "too many length or distance symbols";
                state.mode = BAD;
                break;
              }
              state.have = 0;
              state.mode = LENLENS;
            /* falls through */
            case LENLENS:
              while (state.have < state.ncode) {
                while (bits2 < 3) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits2;
                  bits2 += 8;
                }
                state.lens[order[state.have++]] = hold & 7;
                hold >>>= 3;
                bits2 -= 3;
              }
              while (state.have < 19) {
                state.lens[order[state.have++]] = 0;
              }
              state.lencode = state.lendyn;
              state.lenbits = 7;
              opts = { bits: state.lenbits };
              ret = inflate_table(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
              state.lenbits = opts.bits;
              if (ret) {
                strm.msg = "invalid code lengths set";
                state.mode = BAD;
                break;
              }
              state.have = 0;
              state.mode = CODELENS;
            /* falls through */
            case CODELENS:
              while (state.have < state.nlen + state.ndist) {
                for (; ; ) {
                  here = state.lencode[hold & (1 << state.lenbits) - 1];
                  here_bits = here >>> 24;
                  here_op = here >>> 16 & 255;
                  here_val = here & 65535;
                  if (here_bits <= bits2) {
                    break;
                  }
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits2;
                  bits2 += 8;
                }
                if (here_val < 16) {
                  hold >>>= here_bits;
                  bits2 -= here_bits;
                  state.lens[state.have++] = here_val;
                } else {
                  if (here_val === 16) {
                    n = here_bits + 2;
                    while (bits2 < n) {
                      if (have === 0) {
                        break inf_leave;
                      }
                      have--;
                      hold += input[next++] << bits2;
                      bits2 += 8;
                    }
                    hold >>>= here_bits;
                    bits2 -= here_bits;
                    if (state.have === 0) {
                      strm.msg = "invalid bit length repeat";
                      state.mode = BAD;
                      break;
                    }
                    len = state.lens[state.have - 1];
                    copy = 3 + (hold & 3);
                    hold >>>= 2;
                    bits2 -= 2;
                  } else if (here_val === 17) {
                    n = here_bits + 3;
                    while (bits2 < n) {
                      if (have === 0) {
                        break inf_leave;
                      }
                      have--;
                      hold += input[next++] << bits2;
                      bits2 += 8;
                    }
                    hold >>>= here_bits;
                    bits2 -= here_bits;
                    len = 0;
                    copy = 3 + (hold & 7);
                    hold >>>= 3;
                    bits2 -= 3;
                  } else {
                    n = here_bits + 7;
                    while (bits2 < n) {
                      if (have === 0) {
                        break inf_leave;
                      }
                      have--;
                      hold += input[next++] << bits2;
                      bits2 += 8;
                    }
                    hold >>>= here_bits;
                    bits2 -= here_bits;
                    len = 0;
                    copy = 11 + (hold & 127);
                    hold >>>= 7;
                    bits2 -= 7;
                  }
                  if (state.have + copy > state.nlen + state.ndist) {
                    strm.msg = "invalid bit length repeat";
                    state.mode = BAD;
                    break;
                  }
                  while (copy--) {
                    state.lens[state.have++] = len;
                  }
                }
              }
              if (state.mode === BAD) {
                break;
              }
              if (state.lens[256] === 0) {
                strm.msg = "invalid code -- missing end-of-block";
                state.mode = BAD;
                break;
              }
              state.lenbits = 9;
              opts = { bits: state.lenbits };
              ret = inflate_table(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
              state.lenbits = opts.bits;
              if (ret) {
                strm.msg = "invalid literal/lengths set";
                state.mode = BAD;
                break;
              }
              state.distbits = 6;
              state.distcode = state.distdyn;
              opts = { bits: state.distbits };
              ret = inflate_table(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
              state.distbits = opts.bits;
              if (ret) {
                strm.msg = "invalid distances set";
                state.mode = BAD;
                break;
              }
              state.mode = LEN_;
              if (flush === Z_TREES) {
                break inf_leave;
              }
            /* falls through */
            case LEN_:
              state.mode = LEN;
            /* falls through */
            case LEN:
              if (have >= 6 && left >= 258) {
                strm.next_out = put;
                strm.avail_out = left;
                strm.next_in = next;
                strm.avail_in = have;
                state.hold = hold;
                state.bits = bits2;
                inflate_fast(strm, _out);
                put = strm.next_out;
                output = strm.output;
                left = strm.avail_out;
                next = strm.next_in;
                input = strm.input;
                have = strm.avail_in;
                hold = state.hold;
                bits2 = state.bits;
                if (state.mode === TYPE) {
                  state.back = -1;
                }
                break;
              }
              state.back = 0;
              for (; ; ) {
                here = state.lencode[hold & (1 << state.lenbits) - 1];
                here_bits = here >>> 24;
                here_op = here >>> 16 & 255;
                here_val = here & 65535;
                if (here_bits <= bits2) {
                  break;
                }
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits2;
                bits2 += 8;
              }
              if (here_op && (here_op & 240) === 0) {
                last_bits = here_bits;
                last_op = here_op;
                last_val = here_val;
                for (; ; ) {
                  here = state.lencode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
                  here_bits = here >>> 24;
                  here_op = here >>> 16 & 255;
                  here_val = here & 65535;
                  if (last_bits + here_bits <= bits2) {
                    break;
                  }
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits2;
                  bits2 += 8;
                }
                hold >>>= last_bits;
                bits2 -= last_bits;
                state.back += last_bits;
              }
              hold >>>= here_bits;
              bits2 -= here_bits;
              state.back += here_bits;
              state.length = here_val;
              if (here_op === 0) {
                state.mode = LIT;
                break;
              }
              if (here_op & 32) {
                state.back = -1;
                state.mode = TYPE;
                break;
              }
              if (here_op & 64) {
                strm.msg = "invalid literal/length code";
                state.mode = BAD;
                break;
              }
              state.extra = here_op & 15;
              state.mode = LENEXT;
            /* falls through */
            case LENEXT:
              if (state.extra) {
                n = state.extra;
                while (bits2 < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits2;
                  bits2 += 8;
                }
                state.length += hold & (1 << state.extra) - 1;
                hold >>>= state.extra;
                bits2 -= state.extra;
                state.back += state.extra;
              }
              state.was = state.length;
              state.mode = DIST;
            /* falls through */
            case DIST:
              for (; ; ) {
                here = state.distcode[hold & (1 << state.distbits) - 1];
                here_bits = here >>> 24;
                here_op = here >>> 16 & 255;
                here_val = here & 65535;
                if (here_bits <= bits2) {
                  break;
                }
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits2;
                bits2 += 8;
              }
              if ((here_op & 240) === 0) {
                last_bits = here_bits;
                last_op = here_op;
                last_val = here_val;
                for (; ; ) {
                  here = state.distcode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
                  here_bits = here >>> 24;
                  here_op = here >>> 16 & 255;
                  here_val = here & 65535;
                  if (last_bits + here_bits <= bits2) {
                    break;
                  }
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits2;
                  bits2 += 8;
                }
                hold >>>= last_bits;
                bits2 -= last_bits;
                state.back += last_bits;
              }
              hold >>>= here_bits;
              bits2 -= here_bits;
              state.back += here_bits;
              if (here_op & 64) {
                strm.msg = "invalid distance code";
                state.mode = BAD;
                break;
              }
              state.offset = here_val;
              state.extra = here_op & 15;
              state.mode = DISTEXT;
            /* falls through */
            case DISTEXT:
              if (state.extra) {
                n = state.extra;
                while (bits2 < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits2;
                  bits2 += 8;
                }
                state.offset += hold & (1 << state.extra) - 1;
                hold >>>= state.extra;
                bits2 -= state.extra;
                state.back += state.extra;
              }
              if (state.offset > state.dmax) {
                strm.msg = "invalid distance too far back";
                state.mode = BAD;
                break;
              }
              state.mode = MATCH;
            /* falls through */
            case MATCH:
              if (left === 0) {
                break inf_leave;
              }
              copy = _out - left;
              if (state.offset > copy) {
                copy = state.offset - copy;
                if (copy > state.whave) {
                  if (state.sane) {
                    strm.msg = "invalid distance too far back";
                    state.mode = BAD;
                    break;
                  }
                }
                if (copy > state.wnext) {
                  copy -= state.wnext;
                  from = state.wsize - copy;
                } else {
                  from = state.wnext - copy;
                }
                if (copy > state.length) {
                  copy = state.length;
                }
                from_source = state.window;
              } else {
                from_source = output;
                from = put - state.offset;
                copy = state.length;
              }
              if (copy > left) {
                copy = left;
              }
              left -= copy;
              state.length -= copy;
              do {
                output[put++] = from_source[from++];
              } while (--copy);
              if (state.length === 0) {
                state.mode = LEN;
              }
              break;
            case LIT:
              if (left === 0) {
                break inf_leave;
              }
              output[put++] = state.length;
              left--;
              state.mode = LEN;
              break;
            case CHECK:
              if (state.wrap) {
                while (bits2 < 32) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold |= input[next++] << bits2;
                  bits2 += 8;
                }
                _out -= left;
                strm.total_out += _out;
                state.total += _out;
                if (state.wrap & 4 && _out) {
                  strm.adler = state.check = /*UPDATE_CHECK(state.check, put - _out, _out);*/
                  state.flags ? crc32(state.check, output, _out, put - _out) : adler32(state.check, output, _out, put - _out);
                }
                _out = left;
                if (state.wrap & 4 && (state.flags ? hold : zswap32(hold)) !== state.check) {
                  strm.msg = "incorrect data check";
                  state.mode = BAD;
                  break;
                }
                hold = 0;
                bits2 = 0;
              }
              state.mode = LENGTH;
            /* falls through */
            case LENGTH:
              if (state.wrap && state.flags) {
                while (bits2 < 32) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits2;
                  bits2 += 8;
                }
                if (state.wrap & 4 && hold !== (state.total & 4294967295)) {
                  strm.msg = "incorrect length check";
                  state.mode = BAD;
                  break;
                }
                hold = 0;
                bits2 = 0;
              }
              state.mode = DONE;
            /* falls through */
            case DONE:
              ret = Z_STREAM_END;
              break inf_leave;
            case BAD:
              ret = Z_DATA_ERROR;
              break inf_leave;
            case MEM:
              return Z_MEM_ERROR;
            case SYNC:
            /* falls through */
            default:
              return Z_STREAM_ERROR;
          }
        }
      strm.next_out = put;
      strm.avail_out = left;
      strm.next_in = next;
      strm.avail_in = have;
      state.hold = hold;
      state.bits = bits2;
      if (state.wsize || _out !== strm.avail_out && state.mode < BAD && (state.mode < CHECK || flush !== Z_FINISH)) {
        if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) {
          state.mode = MEM;
          return Z_MEM_ERROR;
        }
      }
      _in -= strm.avail_in;
      _out -= strm.avail_out;
      strm.total_in += _in;
      strm.total_out += _out;
      state.total += _out;
      if (state.wrap & 4 && _out) {
        strm.adler = state.check = /*UPDATE_CHECK(state.check, strm.next_out - _out, _out);*/
        state.flags ? crc32(state.check, output, _out, strm.next_out - _out) : adler32(state.check, output, _out, strm.next_out - _out);
      }
      strm.data_type = state.bits + (state.last ? 64 : 0) + (state.mode === TYPE ? 128 : 0) + (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
      if ((_in === 0 && _out === 0 || flush === Z_FINISH) && ret === Z_OK) {
        ret = Z_BUF_ERROR;
      }
      return ret;
    };
    var inflateEnd = (strm) => {
      if (inflateStateCheck(strm)) {
        return Z_STREAM_ERROR;
      }
      let state = strm.state;
      if (state.window) {
        state.window = null;
      }
      strm.state = null;
      return Z_OK;
    };
    var inflateGetHeader = (strm, head) => {
      if (inflateStateCheck(strm)) {
        return Z_STREAM_ERROR;
      }
      const state = strm.state;
      if ((state.wrap & 2) === 0) {
        return Z_STREAM_ERROR;
      }
      state.head = head;
      head.done = false;
      return Z_OK;
    };
    var inflateSetDictionary = (strm, dictionary) => {
      const dictLength = dictionary.length;
      let state;
      let dictid;
      let ret;
      if (inflateStateCheck(strm)) {
        return Z_STREAM_ERROR;
      }
      state = strm.state;
      if (state.wrap !== 0 && state.mode !== DICT) {
        return Z_STREAM_ERROR;
      }
      if (state.mode === DICT) {
        dictid = 1;
        dictid = adler32(dictid, dictionary, dictLength, 0);
        if (dictid !== state.check) {
          return Z_DATA_ERROR;
        }
      }
      ret = updatewindow(strm, dictionary, dictLength, dictLength);
      if (ret) {
        state.mode = MEM;
        return Z_MEM_ERROR;
      }
      state.havedict = 1;
      return Z_OK;
    };
    module2.exports.inflateReset = inflateReset;
    module2.exports.inflateReset2 = inflateReset2;
    module2.exports.inflateResetKeep = inflateResetKeep;
    module2.exports.inflateInit = inflateInit;
    module2.exports.inflateInit2 = inflateInit2;
    module2.exports.inflate = inflate;
    module2.exports.inflateEnd = inflateEnd;
    module2.exports.inflateGetHeader = inflateGetHeader;
    module2.exports.inflateSetDictionary = inflateSetDictionary;
    module2.exports.inflateInfo = "pako inflate (from Nodeca project)";
  }
});

// ../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/zstream.js
var require_zstream = __commonJS({
  "../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/zstream.js"(exports2, module2) {
    "use strict";
    function ZStream2() {
      this.input = null;
      this.next_in = 0;
      this.avail_in = 0;
      this.total_in = 0;
      this.output = null;
      this.next_out = 0;
      this.avail_out = 0;
      this.total_out = 0;
      this.msg = "";
      this.state = null;
      this.data_type = 2;
      this.adler = 0;
    }
    module2.exports = ZStream2;
  }
});

// ../image-codecs/node_modules/.pnpm/jpeg-js@0.4.4_patch_hash=9f_7b177a39bcbb567e1a40d7d8ec08ec1e/node_modules/jpeg-js/lib/decoder.js
var require_decoder = __commonJS({
  "../image-codecs/node_modules/.pnpm/jpeg-js@0.4.4_patch_hash=9f_7b177a39bcbb567e1a40d7d8ec08ec1e/node_modules/jpeg-js/lib/decoder.js"(exports2, module2) {
    var JpegImage = (function jpegImage() {
      "use strict";
      var dctZigZag = new Int32Array([
        0,
        1,
        8,
        16,
        9,
        2,
        3,
        10,
        17,
        24,
        32,
        25,
        18,
        11,
        4,
        5,
        12,
        19,
        26,
        33,
        40,
        48,
        41,
        34,
        27,
        20,
        13,
        6,
        7,
        14,
        21,
        28,
        35,
        42,
        49,
        56,
        57,
        50,
        43,
        36,
        29,
        22,
        15,
        23,
        30,
        37,
        44,
        51,
        58,
        59,
        52,
        45,
        38,
        31,
        39,
        46,
        53,
        60,
        61,
        54,
        47,
        55,
        62,
        63
      ]);
      var dctCos1 = 4017;
      var dctSin1 = 799;
      var dctCos3 = 3406;
      var dctSin3 = 2276;
      var dctCos6 = 1567;
      var dctSin6 = 3784;
      var dctSqrt2 = 5793;
      var dctSqrt1d2 = 2896;
      function constructor() {
      }
      function buildHuffmanTable(codeLengths, values2) {
        var k = 0, code = [], i2, j, length = 16;
        while (length > 0 && !codeLengths[length - 1])
          length--;
        code.push({ children: [], index: 0 });
        var p = code[0], q;
        for (i2 = 0; i2 < length; i2++) {
          for (j = 0; j < codeLengths[i2]; j++) {
            p = code.pop();
            p.children[p.index] = values2[k];
            while (p.index > 0) {
              if (code.length === 0)
                throw new Error("Could not recreate Huffman Table");
              p = code.pop();
            }
            p.index++;
            code.push(p);
            while (code.length <= i2) {
              code.push(q = { children: [], index: 0 });
              p.children[p.index] = q.children;
              p = q;
            }
            k++;
          }
          if (i2 + 1 < length) {
            code.push(q = { children: [], index: 0 });
            p.children[p.index] = q.children;
            p = q;
          }
        }
        return code[0].children;
      }
      function decodeScan(data, offset, frame, components, resetInterval, spectralStart, spectralEnd, successivePrev, successive, opts) {
        var precision = frame.precision;
        var samplesPerLine = frame.samplesPerLine;
        var scanLines = frame.scanLines;
        var mcusPerLine = frame.mcusPerLine;
        var progressive = frame.progressive;
        var maxH = frame.maxH, maxV = frame.maxV;
        var startOffset = offset, bitsData = 0, bitsCount = 0;
        function readBit() {
          if (bitsCount > 0) {
            bitsCount--;
            return bitsData >> bitsCount & 1;
          }
          bitsData = data[offset++];
          if (bitsData == 255) {
            var nextByte = data[offset++];
            if (nextByte) {
              throw new Error("unexpected marker: " + (bitsData << 8 | nextByte).toString(16));
            }
          }
          bitsCount = 7;
          return bitsData >>> 7;
        }
        function decodeHuffman(tree) {
          var node = tree, bit;
          while ((bit = readBit()) !== null) {
            node = node[bit];
            if (typeof node === "number")
              return node;
            if (typeof node !== "object")
              throw new Error("invalid huffman sequence");
          }
          return null;
        }
        function receive(length) {
          var n2 = 0;
          while (length > 0) {
            var bit = readBit();
            if (bit === null) return;
            n2 = n2 << 1 | bit;
            length--;
          }
          return n2;
        }
        function receiveAndExtend(length) {
          var n2 = receive(length);
          if (n2 >= 1 << length - 1)
            return n2;
          return n2 + (-1 << length) + 1;
        }
        function decodeBaseline(component2, zz) {
          var t = decodeHuffman(component2.huffmanTableDC);
          var diff = t === 0 ? 0 : receiveAndExtend(t);
          zz[0] = component2.pred += diff;
          var k2 = 1;
          while (k2 < 64) {
            var rs = decodeHuffman(component2.huffmanTableAC);
            var s = rs & 15, r = rs >> 4;
            if (s === 0) {
              if (r < 15)
                break;
              k2 += 16;
              if (!opts.tolerantDecoding && k2 > 64) throw new Error("AC run exceeds block");
              continue;
            }
            k2 += r;
            if (!opts.tolerantDecoding && k2 >= 64) throw new Error("AC coefficient exceeds block");
            var z = dctZigZag[k2];
            zz[z] = receiveAndExtend(s);
            k2++;
          }
        }
        function decodeDCFirst(component2, zz) {
          var t = decodeHuffman(component2.huffmanTableDC);
          var diff = t === 0 ? 0 : receiveAndExtend(t) << successive;
          zz[0] = component2.pred += diff;
        }
        function decodeDCSuccessive(component2, zz) {
          zz[0] |= readBit() << successive;
        }
        var eobrun = 0;
        function decodeACFirst(component2, zz) {
          if (eobrun > 0) {
            eobrun--;
            return;
          }
          var k2 = spectralStart, e = spectralEnd;
          while (k2 <= e) {
            var rs = decodeHuffman(component2.huffmanTableAC);
            var s = rs & 15, r = rs >> 4;
            if (s === 0) {
              if (r < 15) {
                eobrun = receive(r) + (1 << r) - 1;
                break;
              }
              k2 += 16;
              if (!opts.tolerantDecoding && k2 > spectralEnd + 1) throw new Error("AC run exceeds spectral band");
              continue;
            }
            k2 += r;
            if (!opts.tolerantDecoding && k2 > spectralEnd) throw new Error("AC coefficient exceeds spectral band");
            var z = dctZigZag[k2];
            zz[z] = receiveAndExtend(s) * (1 << successive);
            k2++;
          }
        }
        var successiveACState = 0, successiveACNextValue;
        function decodeACSuccessive(component2, zz) {
          var k2 = spectralStart, e = spectralEnd, r = 0;
          while (k2 <= e) {
            var z = dctZigZag[k2];
            var direction = zz[z] < 0 ? -1 : 1;
            switch (successiveACState) {
              case 0:
                var rs = decodeHuffman(component2.huffmanTableAC);
                var s = rs & 15, r = rs >> 4;
                if (s === 0) {
                  if (r < 15) {
                    eobrun = receive(r) + (1 << r);
                    successiveACState = 4;
                  } else {
                    r = 16;
                    successiveACState = 1;
                  }
                } else {
                  if (s !== 1)
                    throw new Error("invalid ACn encoding");
                  successiveACNextValue = receiveAndExtend(s);
                  successiveACState = r ? 2 : 3;
                }
                continue;
              case 1:
              // skipping r zero items
              case 2:
                if (zz[z])
                  zz[z] += (readBit() << successive) * direction;
                else {
                  r--;
                  if (r === 0)
                    successiveACState = successiveACState == 2 ? 3 : 0;
                }
                break;
              case 3:
                if (zz[z])
                  zz[z] += (readBit() << successive) * direction;
                else {
                  zz[z] = successiveACNextValue << successive;
                  successiveACState = 0;
                }
                break;
              case 4:
                if (zz[z])
                  zz[z] += (readBit() << successive) * direction;
                break;
            }
            k2++;
          }
          if (!opts.tolerantDecoding && successiveACState !== 0 && successiveACState !== 4) {
            throw new Error("unfinished AC refinement run at block boundary");
          }
          if (successiveACState === 4) {
            eobrun--;
            if (eobrun === 0)
              successiveACState = 0;
          }
        }
        function decodeMcu(component2, decode5, mcu2, row, col) {
          var mcuRow = mcu2 / mcusPerLine | 0;
          var mcuCol = mcu2 % mcusPerLine;
          var blockRow = mcuRow * component2.v + row;
          var blockCol = mcuCol * component2.h + col;
          if (component2.blocks[blockRow] === void 0 && opts.tolerantDecoding)
            return;
          decode5(component2, component2.blocks[blockRow][blockCol]);
        }
        function decodeBlock(component2, decode5, mcu2) {
          var blockRow = mcu2 / component2.blocksPerLine | 0;
          var blockCol = mcu2 % component2.blocksPerLine;
          if (component2.blocks[blockRow] === void 0 && opts.tolerantDecoding)
            return;
          decode5(component2, component2.blocks[blockRow][blockCol]);
        }
        var componentsLength = components.length;
        var component, i2, j, k, n;
        var decodeFn;
        if (progressive) {
          if (spectralStart === 0)
            decodeFn = successivePrev === 0 ? decodeDCFirst : decodeDCSuccessive;
          else
            decodeFn = successivePrev === 0 ? decodeACFirst : decodeACSuccessive;
        } else {
          decodeFn = decodeBaseline;
        }
        var mcu = 0, marker;
        var mcuExpected;
        if (componentsLength == 1) {
          mcuExpected = components[0].blocksPerLine * components[0].blocksPerColumn;
        } else {
          mcuExpected = mcusPerLine * frame.mcusPerColumn;
        }
        if (!resetInterval) resetInterval = mcuExpected;
        var h, v;
        while (mcu < mcuExpected) {
          for (i2 = 0; i2 < componentsLength; i2++)
            components[i2].pred = 0;
          eobrun = 0;
          if (componentsLength == 1) {
            component = components[0];
            for (n = 0; n < resetInterval; n++) {
              decodeBlock(component, decodeFn, mcu);
              mcu++;
              if (mcu === mcuExpected) break;
            }
          } else {
            for (n = 0; n < resetInterval; n++) {
              for (i2 = 0; i2 < componentsLength; i2++) {
                component = components[i2];
                h = component.h;
                v = component.v;
                for (j = 0; j < v; j++) {
                  for (k = 0; k < h; k++) {
                    decodeMcu(component, decodeFn, mcu, j, k);
                  }
                }
              }
              mcu++;
              if (mcu === mcuExpected) break;
            }
          }
          if (!opts.tolerantDecoding) {
            if (eobrun > 0) throw new Error("EOB run exceeds scan or restart boundary");
            var paddingMask = (1 << bitsCount) - 1;
            if ((bitsData & paddingMask) !== paddingMask || data[offset] !== 255 || data[offset + 1] === 0) {
              throw new Error("invalid entropy padding or unused entropy bytes");
            }
            while (data[offset] === 255 && data[offset + 1] === 255) offset++;
          }
          if (mcu === mcuExpected && opts.tolerantDecoding) {
            do {
              if (data[offset] === 255) {
                if (data[offset + 1] !== 0) {
                  break;
                }
              }
              offset += 1;
            } while (offset < data.length - 2);
          }
          bitsCount = 0;
          marker = data[offset] << 8 | data[offset + 1];
          if (marker < 65280) {
            throw new Error("marker was not found");
          }
          if (marker >= 65488 && marker <= 65495) {
            offset += 2;
          } else
            break;
        }
        return offset - startOffset;
      }
      function buildComponentData(frame, component) {
        var lines = [];
        var blocksPerLine = component.blocksPerLine;
        var blocksPerColumn = component.blocksPerColumn;
        var samplesPerLine = blocksPerLine << 3;
        var R = new Int32Array(64), r = new Uint8Array(64);
        function quantizeAndInverse(zz, dataOut, dataIn) {
          var qt = component.quantizationTable;
          var v0, v1, v2, v3, v4, v5, v6, v7, t;
          var p = dataIn;
          var i3;
          for (i3 = 0; i3 < 64; i3++)
            p[i3] = zz[i3] * qt[i3];
          for (i3 = 0; i3 < 8; ++i3) {
            var row = 8 * i3;
            if (p[1 + row] == 0 && p[2 + row] == 0 && p[3 + row] == 0 && p[4 + row] == 0 && p[5 + row] == 0 && p[6 + row] == 0 && p[7 + row] == 0) {
              t = dctSqrt2 * p[0 + row] + 512 >> 10;
              p[0 + row] = t;
              p[1 + row] = t;
              p[2 + row] = t;
              p[3 + row] = t;
              p[4 + row] = t;
              p[5 + row] = t;
              p[6 + row] = t;
              p[7 + row] = t;
              continue;
            }
            v0 = dctSqrt2 * p[0 + row] + 128 >> 8;
            v1 = dctSqrt2 * p[4 + row] + 128 >> 8;
            v2 = p[2 + row];
            v3 = p[6 + row];
            v4 = dctSqrt1d2 * (p[1 + row] - p[7 + row]) + 128 >> 8;
            v7 = dctSqrt1d2 * (p[1 + row] + p[7 + row]) + 128 >> 8;
            v5 = p[3 + row] << 4;
            v6 = p[5 + row] << 4;
            t = v0 - v1 + 1 >> 1;
            v0 = v0 + v1 + 1 >> 1;
            v1 = t;
            t = v2 * dctSin6 + v3 * dctCos6 + 128 >> 8;
            v2 = v2 * dctCos6 - v3 * dctSin6 + 128 >> 8;
            v3 = t;
            t = v4 - v6 + 1 >> 1;
            v4 = v4 + v6 + 1 >> 1;
            v6 = t;
            t = v7 + v5 + 1 >> 1;
            v5 = v7 - v5 + 1 >> 1;
            v7 = t;
            t = v0 - v3 + 1 >> 1;
            v0 = v0 + v3 + 1 >> 1;
            v3 = t;
            t = v1 - v2 + 1 >> 1;
            v1 = v1 + v2 + 1 >> 1;
            v2 = t;
            t = v4 * dctSin3 + v7 * dctCos3 + 2048 >> 12;
            v4 = v4 * dctCos3 - v7 * dctSin3 + 2048 >> 12;
            v7 = t;
            t = v5 * dctSin1 + v6 * dctCos1 + 2048 >> 12;
            v5 = v5 * dctCos1 - v6 * dctSin1 + 2048 >> 12;
            v6 = t;
            p[0 + row] = v0 + v7;
            p[7 + row] = v0 - v7;
            p[1 + row] = v1 + v6;
            p[6 + row] = v1 - v6;
            p[2 + row] = v2 + v5;
            p[5 + row] = v2 - v5;
            p[3 + row] = v3 + v4;
            p[4 + row] = v3 - v4;
          }
          for (i3 = 0; i3 < 8; ++i3) {
            var col = i3;
            if (p[1 * 8 + col] == 0 && p[2 * 8 + col] == 0 && p[3 * 8 + col] == 0 && p[4 * 8 + col] == 0 && p[5 * 8 + col] == 0 && p[6 * 8 + col] == 0 && p[7 * 8 + col] == 0) {
              t = dctSqrt2 * dataIn[i3 + 0] + 8192 >> 14;
              p[0 * 8 + col] = t;
              p[1 * 8 + col] = t;
              p[2 * 8 + col] = t;
              p[3 * 8 + col] = t;
              p[4 * 8 + col] = t;
              p[5 * 8 + col] = t;
              p[6 * 8 + col] = t;
              p[7 * 8 + col] = t;
              continue;
            }
            v0 = dctSqrt2 * p[0 * 8 + col] + 2048 >> 12;
            v1 = dctSqrt2 * p[4 * 8 + col] + 2048 >> 12;
            v2 = p[2 * 8 + col];
            v3 = p[6 * 8 + col];
            v4 = dctSqrt1d2 * (p[1 * 8 + col] - p[7 * 8 + col]) + 2048 >> 12;
            v7 = dctSqrt1d2 * (p[1 * 8 + col] + p[7 * 8 + col]) + 2048 >> 12;
            v5 = p[3 * 8 + col];
            v6 = p[5 * 8 + col];
            t = v0 - v1 + 1 >> 1;
            v0 = v0 + v1 + 1 >> 1;
            v1 = t;
            t = v2 * dctSin6 + v3 * dctCos6 + 2048 >> 12;
            v2 = v2 * dctCos6 - v3 * dctSin6 + 2048 >> 12;
            v3 = t;
            t = v4 - v6 + 1 >> 1;
            v4 = v4 + v6 + 1 >> 1;
            v6 = t;
            t = v7 + v5 + 1 >> 1;
            v5 = v7 - v5 + 1 >> 1;
            v7 = t;
            t = v0 - v3 + 1 >> 1;
            v0 = v0 + v3 + 1 >> 1;
            v3 = t;
            t = v1 - v2 + 1 >> 1;
            v1 = v1 + v2 + 1 >> 1;
            v2 = t;
            t = v4 * dctSin3 + v7 * dctCos3 + 2048 >> 12;
            v4 = v4 * dctCos3 - v7 * dctSin3 + 2048 >> 12;
            v7 = t;
            t = v5 * dctSin1 + v6 * dctCos1 + 2048 >> 12;
            v5 = v5 * dctCos1 - v6 * dctSin1 + 2048 >> 12;
            v6 = t;
            p[0 * 8 + col] = v0 + v7;
            p[7 * 8 + col] = v0 - v7;
            p[1 * 8 + col] = v1 + v6;
            p[6 * 8 + col] = v1 - v6;
            p[2 * 8 + col] = v2 + v5;
            p[5 * 8 + col] = v2 - v5;
            p[3 * 8 + col] = v3 + v4;
            p[4 * 8 + col] = v3 - v4;
          }
          for (i3 = 0; i3 < 64; ++i3) {
            var sample2 = 128 + (p[i3] + 8 >> 4);
            dataOut[i3] = sample2 < 0 ? 0 : sample2 > 255 ? 255 : sample2;
          }
        }
        requestMemoryAllocation(samplesPerLine * blocksPerColumn * 8);
        var i2, j;
        for (var blockRow = 0; blockRow < blocksPerColumn; blockRow++) {
          var scanLine = blockRow << 3;
          for (i2 = 0; i2 < 8; i2++)
            lines.push(new Uint8Array(samplesPerLine));
          for (var blockCol = 0; blockCol < blocksPerLine; blockCol++) {
            quantizeAndInverse(component.blocks[blockRow][blockCol], r, R);
            var offset = 0, sample = blockCol << 3;
            for (j = 0; j < 8; j++) {
              var line = lines[scanLine + j];
              for (i2 = 0; i2 < 8; i2++)
                line[sample + i2] = r[offset++];
            }
          }
        }
        return lines;
      }
      function clampTo8bit(a) {
        return a < 0 ? 0 : a > 255 ? 255 : a;
      }
      constructor.prototype = {
        load: function load(path) {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", path, true);
          xhr.responseType = "arraybuffer";
          xhr.onload = (function() {
            var data = new Uint8Array(xhr.response || xhr.mozResponseArrayBuffer);
            this.parse(data);
            if (this.onload)
              this.onload();
          }).bind(this);
          xhr.send(null);
        },
        parse: function parse(data) {
          var maxResolutionInPixels = this.opts.maxResolutionInMP * 1e3 * 1e3;
          var offset = 0, length = data.length;
          function readUint16() {
            var value = data[offset] << 8 | data[offset + 1];
            offset += 2;
            return value;
          }
          function readDataBlock() {
            var length2 = readUint16();
            var array = data.subarray(offset, offset + length2 - 2);
            offset += array.length;
            return array;
          }
          function prepareComponents(frame2) {
            var maxH2 = 1, maxV2 = 1;
            var component2, componentId2;
            for (componentId2 in frame2.components) {
              if (frame2.components.hasOwnProperty(componentId2)) {
                component2 = frame2.components[componentId2];
                if (maxH2 < component2.h) maxH2 = component2.h;
                if (maxV2 < component2.v) maxV2 = component2.v;
              }
            }
            var mcusPerLine = Math.ceil(frame2.samplesPerLine / 8 / maxH2);
            var mcusPerColumn = Math.ceil(frame2.scanLines / 8 / maxV2);
            for (componentId2 in frame2.components) {
              if (frame2.components.hasOwnProperty(componentId2)) {
                component2 = frame2.components[componentId2];
                var blocksPerLine = Math.ceil(Math.ceil(frame2.samplesPerLine / 8) * component2.h / maxH2);
                var blocksPerColumn = Math.ceil(Math.ceil(frame2.scanLines / 8) * component2.v / maxV2);
                var blocksPerLineForMcu = mcusPerLine * component2.h;
                var blocksPerColumnForMcu = mcusPerColumn * component2.v;
                var blocksToAllocate = blocksPerColumnForMcu * blocksPerLineForMcu;
                var blocks = [];
                requestMemoryAllocation(blocksToAllocate * 256);
                for (var i3 = 0; i3 < blocksPerColumnForMcu; i3++) {
                  var row = [];
                  for (var j2 = 0; j2 < blocksPerLineForMcu; j2++)
                    row.push(new Int32Array(64));
                  blocks.push(row);
                }
                component2.blocksPerLine = blocksPerLine;
                component2.blocksPerColumn = blocksPerColumn;
                component2.blocks = blocks;
              }
            }
            frame2.maxH = maxH2;
            frame2.maxV = maxV2;
            frame2.mcusPerLine = mcusPerLine;
            frame2.mcusPerColumn = mcusPerColumn;
          }
          var jfif = null;
          var adobe = null;
          var pixels = null;
          var frame, resetInterval;
          var quantizationTables = [], frames = [];
          var huffmanTablesAC = [], huffmanTablesDC = [];
          var fileMarker = readUint16();
          var malformedDataOffset = -1;
          this.comments = [];
          if (fileMarker != 65496) {
            throw new Error("SOI not found");
          }
          fileMarker = readUint16();
          while (fileMarker != 65497) {
            var i2, j, l;
            switch (fileMarker) {
              case 65280:
                break;
              case 65504:
              // APP0 (Application Specific)
              case 65505:
              // APP1
              case 65506:
              // APP2
              case 65507:
              // APP3
              case 65508:
              // APP4
              case 65509:
              // APP5
              case 65510:
              // APP6
              case 65511:
              // APP7
              case 65512:
              // APP8
              case 65513:
              // APP9
              case 65514:
              // APP10
              case 65515:
              // APP11
              case 65516:
              // APP12
              case 65517:
              // APP13
              case 65518:
              // APP14
              case 65519:
              // APP15
              case 65534:
                var appData = readDataBlock();
                if (fileMarker === 65534) {
                  var comment = String.fromCharCode.apply(null, appData);
                  this.comments.push(comment);
                }
                if (fileMarker === 65504) {
                  if (appData[0] === 74 && appData[1] === 70 && appData[2] === 73 && appData[3] === 70 && appData[4] === 0) {
                    jfif = {
                      version: { major: appData[5], minor: appData[6] },
                      densityUnits: appData[7],
                      xDensity: appData[8] << 8 | appData[9],
                      yDensity: appData[10] << 8 | appData[11],
                      thumbWidth: appData[12],
                      thumbHeight: appData[13],
                      thumbData: appData.subarray(14, 14 + 3 * appData[12] * appData[13])
                    };
                  }
                }
                if (fileMarker === 65505) {
                  if (appData[0] === 69 && appData[1] === 120 && appData[2] === 105 && appData[3] === 102 && appData[4] === 0) {
                    this.exifBuffer = appData.subarray(5, appData.length);
                  }
                }
                if (fileMarker === 65518) {
                  if (appData[0] === 65 && appData[1] === 100 && appData[2] === 111 && appData[3] === 98 && appData[4] === 101 && appData[5] === 0) {
                    adobe = {
                      version: appData[6],
                      flags0: appData[7] << 8 | appData[8],
                      flags1: appData[9] << 8 | appData[10],
                      transformCode: appData[11]
                    };
                  }
                }
                break;
              case 65499:
                var quantizationTablesLength = readUint16();
                var quantizationTablesEnd = quantizationTablesLength + offset - 2;
                while (offset < quantizationTablesEnd) {
                  var quantizationTableSpec = data[offset++];
                  requestMemoryAllocation(64 * 4);
                  var tableData = new Int32Array(64);
                  if (quantizationTableSpec >> 4 === 0) {
                    for (j = 0; j < 64; j++) {
                      var z = dctZigZag[j];
                      tableData[z] = data[offset++];
                    }
                  } else if (quantizationTableSpec >> 4 === 1) {
                    for (j = 0; j < 64; j++) {
                      var z = dctZigZag[j];
                      tableData[z] = readUint16();
                    }
                  } else
                    throw new Error("DQT: invalid table spec");
                  quantizationTables[quantizationTableSpec & 15] = tableData;
                }
                break;
              case 65472:
              // SOF0 (Start of Frame, Baseline DCT)
              case 65473:
              // SOF1 (Start of Frame, Extended DCT)
              case 65474:
                readUint16();
                frame = {};
                frame.extended = fileMarker === 65473;
                frame.progressive = fileMarker === 65474;
                frame.precision = data[offset++];
                frame.scanLines = readUint16();
                frame.samplesPerLine = readUint16();
                frame.components = {};
                frame.componentsOrder = [];
                var pixelsInFrame = frame.scanLines * frame.samplesPerLine;
                if (pixelsInFrame > maxResolutionInPixels) {
                  var exceededAmount = Math.ceil((pixelsInFrame - maxResolutionInPixels) / 1e6);
                  throw new Error(`maxResolutionInMP limit exceeded by ${exceededAmount}MP`);
                }
                var componentsCount = data[offset++], componentId;
                var maxH = 0, maxV = 0;
                for (i2 = 0; i2 < componentsCount; i2++) {
                  componentId = data[offset];
                  var h = data[offset + 1] >> 4;
                  var v = data[offset + 1] & 15;
                  var qId = data[offset + 2];
                  if (h <= 0 || v <= 0) {
                    throw new Error("Invalid sampling factor, expected values above 0");
                  }
                  frame.componentsOrder.push(componentId);
                  frame.components[componentId] = {
                    h,
                    v,
                    quantizationIdx: qId
                  };
                  offset += 3;
                }
                prepareComponents(frame);
                frames.push(frame);
                break;
              case 65476:
                var huffmanLength = readUint16();
                for (i2 = 2; i2 < huffmanLength; ) {
                  var huffmanTableSpec = data[offset++];
                  var codeLengths = new Uint8Array(16);
                  var codeLengthSum = 0;
                  for (j = 0; j < 16; j++, offset++) {
                    codeLengthSum += codeLengths[j] = data[offset];
                  }
                  requestMemoryAllocation(16 + codeLengthSum);
                  var huffmanValues = new Uint8Array(codeLengthSum);
                  for (j = 0; j < codeLengthSum; j++, offset++)
                    huffmanValues[j] = data[offset];
                  i2 += 17 + codeLengthSum;
                  (huffmanTableSpec >> 4 === 0 ? huffmanTablesDC : huffmanTablesAC)[huffmanTableSpec & 15] = buildHuffmanTable(codeLengths, huffmanValues);
                }
                break;
              case 65501:
                readUint16();
                resetInterval = readUint16();
                break;
              case 65500:
                readUint16();
                readUint16();
                break;
              case 65498:
                var scanLength = readUint16();
                var selectorsCount = data[offset++];
                var components = [], component;
                for (i2 = 0; i2 < selectorsCount; i2++) {
                  component = frame.components[data[offset++]];
                  var tableSpec = data[offset++];
                  component.huffmanTableDC = huffmanTablesDC[tableSpec >> 4];
                  component.huffmanTableAC = huffmanTablesAC[tableSpec & 15];
                  components.push(component);
                }
                var spectralStart = data[offset++];
                var spectralEnd = data[offset++];
                var successiveApproximation = data[offset++];
                var processed = decodeScan(
                  data,
                  offset,
                  frame,
                  components,
                  resetInterval,
                  spectralStart,
                  spectralEnd,
                  successiveApproximation >> 4,
                  successiveApproximation & 15,
                  this.opts
                );
                offset += processed;
                break;
              case 65535:
                if (data[offset] !== 255) {
                  offset--;
                }
                break;
              default:
                if (data[offset - 3] == 255 && data[offset - 2] >= 192 && data[offset - 2] <= 254) {
                  offset -= 3;
                  break;
                } else if (fileMarker === 224 || fileMarker == 225) {
                  if (malformedDataOffset !== -1) {
                    throw new Error(`first unknown JPEG marker at offset ${malformedDataOffset.toString(16)}, second unknown JPEG marker ${fileMarker.toString(16)} at offset ${(offset - 1).toString(16)}`);
                  }
                  malformedDataOffset = offset - 1;
                  const nextOffset = readUint16();
                  if (data[offset + nextOffset - 2] === 255) {
                    offset += nextOffset - 2;
                    break;
                  }
                }
                throw new Error("unknown JPEG marker " + fileMarker.toString(16));
            }
            fileMarker = readUint16();
          }
          if (frames.length != 1)
            throw new Error("only single frame JPEGs supported");
          for (var i2 = 0; i2 < frames.length; i2++) {
            var cp = frames[i2].components;
            for (var j in cp) {
              cp[j].quantizationTable = quantizationTables[cp[j].quantizationIdx];
              delete cp[j].quantizationIdx;
            }
          }
          this.width = frame.samplesPerLine;
          this.height = frame.scanLines;
          this.jfif = jfif;
          this.adobe = adobe;
          this.components = [];
          for (var i2 = 0; i2 < frame.componentsOrder.length; i2++) {
            var component = frame.components[frame.componentsOrder[i2]];
            this.components.push({
              lines: buildComponentData(frame, component),
              scaleX: component.h / frame.maxH,
              scaleY: component.v / frame.maxV
            });
          }
        },
        getData: function getData(width, height) {
          var scaleX = this.width / width, scaleY = this.height / height;
          var component1, component2, component3, component4;
          var component1Line, component2Line, component3Line, component4Line;
          var x2, y;
          var offset = 0;
          var Y, Cb, Cr, K, C, M, Ye, R, G, B;
          var colorTransform;
          var dataLength = width * height * this.components.length;
          requestMemoryAllocation(dataLength);
          var data = new Uint8Array(dataLength);
          switch (this.components.length) {
            case 1:
              component1 = this.components[0];
              for (y = 0; y < height; y++) {
                component1Line = component1.lines[0 | y * component1.scaleY * scaleY];
                for (x2 = 0; x2 < width; x2++) {
                  Y = component1Line[0 | x2 * component1.scaleX * scaleX];
                  data[offset++] = Y;
                }
              }
              break;
            case 2:
              component1 = this.components[0];
              component2 = this.components[1];
              for (y = 0; y < height; y++) {
                component1Line = component1.lines[0 | y * component1.scaleY * scaleY];
                component2Line = component2.lines[0 | y * component2.scaleY * scaleY];
                for (x2 = 0; x2 < width; x2++) {
                  Y = component1Line[0 | x2 * component1.scaleX * scaleX];
                  data[offset++] = Y;
                  Y = component2Line[0 | x2 * component2.scaleX * scaleX];
                  data[offset++] = Y;
                }
              }
              break;
            case 3:
              colorTransform = true;
              if (this.adobe && this.adobe.transformCode)
                colorTransform = true;
              else if (typeof this.opts.colorTransform !== "undefined")
                colorTransform = !!this.opts.colorTransform;
              component1 = this.components[0];
              component2 = this.components[1];
              component3 = this.components[2];
              for (y = 0; y < height; y++) {
                component1Line = component1.lines[0 | y * component1.scaleY * scaleY];
                component2Line = component2.lines[0 | y * component2.scaleY * scaleY];
                component3Line = component3.lines[0 | y * component3.scaleY * scaleY];
                for (x2 = 0; x2 < width; x2++) {
                  if (!colorTransform) {
                    R = component1Line[0 | x2 * component1.scaleX * scaleX];
                    G = component2Line[0 | x2 * component2.scaleX * scaleX];
                    B = component3Line[0 | x2 * component3.scaleX * scaleX];
                  } else {
                    Y = component1Line[0 | x2 * component1.scaleX * scaleX];
                    Cb = component2Line[0 | x2 * component2.scaleX * scaleX];
                    Cr = component3Line[0 | x2 * component3.scaleX * scaleX];
                    R = clampTo8bit(Y + 1.402 * (Cr - 128));
                    G = clampTo8bit(Y - 0.3441363 * (Cb - 128) - 0.71413636 * (Cr - 128));
                    B = clampTo8bit(Y + 1.772 * (Cb - 128));
                  }
                  data[offset++] = R;
                  data[offset++] = G;
                  data[offset++] = B;
                }
              }
              break;
            case 4:
              if (!this.adobe)
                throw new Error("Unsupported color mode (4 components)");
              colorTransform = false;
              if (this.adobe && this.adobe.transformCode)
                colorTransform = true;
              else if (typeof this.opts.colorTransform !== "undefined")
                colorTransform = !!this.opts.colorTransform;
              component1 = this.components[0];
              component2 = this.components[1];
              component3 = this.components[2];
              component4 = this.components[3];
              for (y = 0; y < height; y++) {
                component1Line = component1.lines[0 | y * component1.scaleY * scaleY];
                component2Line = component2.lines[0 | y * component2.scaleY * scaleY];
                component3Line = component3.lines[0 | y * component3.scaleY * scaleY];
                component4Line = component4.lines[0 | y * component4.scaleY * scaleY];
                for (x2 = 0; x2 < width; x2++) {
                  if (!colorTransform) {
                    C = component1Line[0 | x2 * component1.scaleX * scaleX];
                    M = component2Line[0 | x2 * component2.scaleX * scaleX];
                    Ye = component3Line[0 | x2 * component3.scaleX * scaleX];
                    K = component4Line[0 | x2 * component4.scaleX * scaleX];
                  } else {
                    Y = component1Line[0 | x2 * component1.scaleX * scaleX];
                    Cb = component2Line[0 | x2 * component2.scaleX * scaleX];
                    Cr = component3Line[0 | x2 * component3.scaleX * scaleX];
                    K = component4Line[0 | x2 * component4.scaleX * scaleX];
                    C = 255 - clampTo8bit(Y + 1.402 * (Cr - 128));
                    M = 255 - clampTo8bit(Y - 0.3441363 * (Cb - 128) - 0.71413636 * (Cr - 128));
                    Ye = 255 - clampTo8bit(Y + 1.772 * (Cb - 128));
                  }
                  data[offset++] = 255 - C;
                  data[offset++] = 255 - M;
                  data[offset++] = 255 - Ye;
                  data[offset++] = 255 - K;
                }
              }
              break;
            default:
              throw new Error("Unsupported color mode");
          }
          return data;
        },
        copyToImageData: function copyToImageData(imageData, formatAsRGBA) {
          var width = imageData.width, height = imageData.height;
          var imageDataArray = imageData.data;
          var data = this.getData(width, height);
          var i2 = 0, j = 0, x2, y;
          var Y, K, C, M, R, G, B;
          switch (this.components.length) {
            case 1:
              for (y = 0; y < height; y++) {
                for (x2 = 0; x2 < width; x2++) {
                  Y = data[i2++];
                  imageDataArray[j++] = Y;
                  imageDataArray[j++] = Y;
                  imageDataArray[j++] = Y;
                  if (formatAsRGBA) {
                    imageDataArray[j++] = 255;
                  }
                }
              }
              break;
            case 3:
              for (y = 0; y < height; y++) {
                for (x2 = 0; x2 < width; x2++) {
                  R = data[i2++];
                  G = data[i2++];
                  B = data[i2++];
                  imageDataArray[j++] = R;
                  imageDataArray[j++] = G;
                  imageDataArray[j++] = B;
                  if (formatAsRGBA) {
                    imageDataArray[j++] = 255;
                  }
                }
              }
              break;
            case 4:
              for (y = 0; y < height; y++) {
                for (x2 = 0; x2 < width; x2++) {
                  C = data[i2++];
                  M = data[i2++];
                  Y = data[i2++];
                  K = data[i2++];
                  R = 255 - clampTo8bit(C * (1 - K / 255) + K);
                  G = 255 - clampTo8bit(M * (1 - K / 255) + K);
                  B = 255 - clampTo8bit(Y * (1 - K / 255) + K);
                  imageDataArray[j++] = R;
                  imageDataArray[j++] = G;
                  imageDataArray[j++] = B;
                  if (formatAsRGBA) {
                    imageDataArray[j++] = 255;
                  }
                }
              }
              break;
            default:
              throw new Error("Unsupported color mode");
          }
        }
      };
      var totalBytesAllocated = 0;
      var maxMemoryUsageBytes = 0;
      function requestMemoryAllocation(increaseAmount = 0) {
        var totalMemoryImpactBytes = totalBytesAllocated + increaseAmount;
        if (totalMemoryImpactBytes > maxMemoryUsageBytes) {
          var exceededAmount = Math.ceil((totalMemoryImpactBytes - maxMemoryUsageBytes) / 1024 / 1024);
          throw new Error(`maxMemoryUsageInMB limit exceeded by at least ${exceededAmount}MB`);
        }
        totalBytesAllocated = totalMemoryImpactBytes;
      }
      constructor.resetMaxMemoryUsage = function(maxMemoryUsageBytes_) {
        totalBytesAllocated = 0;
        maxMemoryUsageBytes = maxMemoryUsageBytes_;
      };
      constructor.getBytesAllocated = function() {
        return totalBytesAllocated;
      };
      constructor.requestMemoryAllocation = requestMemoryAllocation;
      return constructor;
    })();
    if (typeof module2 !== "undefined") {
      module2.exports = decode4;
    } else if (typeof window !== "undefined") {
      window["jpeg-js"] = window["jpeg-js"] || {};
      window["jpeg-js"].decode = decode4;
    }
    function decode4(jpegData, userOpts = {}) {
      var defaultOpts = {
        // "undefined" means "Choose whether to transform colors based on the image’s color model."
        colorTransform: void 0,
        useTArray: false,
        formatAsRGBA: true,
        tolerantDecoding: true,
        maxResolutionInMP: 100,
        // Don't decode more than 100 megapixels
        maxMemoryUsageInMB: 512
        // Don't decode if memory footprint is more than 512MB
      };
      var opts = { ...defaultOpts, ...userOpts };
      var arr = new Uint8Array(jpegData);
      var decoder = new JpegImage();
      decoder.opts = opts;
      JpegImage.resetMaxMemoryUsage(opts.maxMemoryUsageInMB * 1024 * 1024);
      decoder.parse(arr);
      var channels = opts.formatAsRGBA ? 4 : 3;
      var bytesNeeded = decoder.width * decoder.height * channels;
      try {
        JpegImage.requestMemoryAllocation(bytesNeeded);
        var image = {
          width: decoder.width,
          height: decoder.height,
          exifBuffer: decoder.exifBuffer,
          data: opts.useTArray ? new Uint8Array(bytesNeeded) : Buffer.alloc(bytesNeeded)
        };
        if (decoder.comments.length > 0) {
          image["comments"] = decoder.comments;
        }
      } catch (err2) {
        if (err2 instanceof RangeError) {
          throw new Error("Could not allocate enough memory for the image. Required: " + bytesNeeded);
        }
        if (err2 instanceof ReferenceError) {
          if (err2.message === "Buffer is not defined") {
            throw new Error("Buffer is not globally defined in this environment. Consider setting useTArray to true");
          }
        }
        throw err2;
      }
      decoder.copyToImageData(image, opts.formatAsRGBA);
      return image;
    }
  }
});

// tools/gpu-spike/runtime-validation.mjs
var runtime_validation_exports = {};
__export(runtime_validation_exports, {
  canonicalAssetSet: () => canonicalAssetSet,
  canonicalControlSchemaJson: () => canonicalControlSchemaJson,
  decodeCanonicalBase64: () => decodeCanonicalBase64,
  linkedBody: () => linkedBody,
  normalizeControlSchema: () => normalizeControlSchema,
  validateControlSnapshot: () => validateControlSnapshot
});
module.exports = __toCommonJS(runtime_validation_exports);

// packages/assets/src/limits.mjs
var assetLimits = Object.freeze({ count: 4, imageBytes: 786486, totalBytes: 1048576, rgbaBytes: 2097152, dimension: 512, pathCharacters: 240 });

// ../image-codecs/node_modules/.pnpm/fflate@0.8.2/node_modules/fflate/esm/index.mjs
var import_module = require("module");
var require2 = (0, import_module.createRequire)("/");
var Worker;
try {
  Worker = require2("worker_threads").Worker;
} catch (e) {
}
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b = new u16(31);
  for (var i2 = 0; i2 < 31; ++i2) {
    b[i2] = start += 1 << eb[i2 - 1];
  }
  var r = new i32(b[30]);
  for (var i2 = 1; i2 < 30; ++i2) {
    for (var j = b[i2]; j < b[i2 + 1]; ++j) {
      r[j] = j - b[i2] << 5 | i2;
    }
  }
  return { b, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = (function(cd, mb, r) {
  var s = cd.length;
  var i2 = 0;
  var l = new u16(mb);
  for (; i2 < s; ++i2) {
    if (cd[i2])
      ++l[cd[i2] - 1];
  }
  var le = new u16(mb);
  for (i2 = 1; i2 < mb; ++i2) {
    le[i2] = le[i2 - 1] + l[i2 - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        var sv = i2 << 4 | cd[i2];
        var r_1 = mb - cd[i2];
        var v = le[cd[i2] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i2 = 0; i2 < s; ++i2) {
      if (cd[i2]) {
        co[i2] = rev[le[cd[i2] - 1]++] >> 15 - cd[i2];
      }
    }
  }
  return co;
});
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
var max = function(a) {
  var m = a[0];
  for (var i2 = 1; i2 < a.length; ++i2) {
    if (a[i2] > m)
      m = a[i2];
  }
  return m;
};
var bits = function(d, p, m) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
};
var bits16 = function(d, p) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
};
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var inflt = function(dat, st, buf, dict) {
  var sl = dat.length, dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l)
    return buf || new u8(0);
  var noBuf = !buf;
  var resize = noBuf || st.i != 2;
  var noSt = st.i;
  if (noBuf)
    buf = new u8(sl * 3);
  var cbuf = function(l2) {
    var bl = buf.length;
    if (l2 > bl) {
      var nbuf = new u8(Math.max(bl * 2, l2));
      nbuf.set(buf);
      buf = nbuf;
    }
  };
  var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
  var tbts = sl * 8;
  do {
    if (!lm) {
      final = bits(dat, pos, 1);
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
        if (t > sl) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + l);
        buf.set(dat.subarray(s, t), bt);
        st.b = bt += l, st.p = pos = t * 8, st.f = final;
        continue;
      } else if (type == 1)
        lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        var ldt = new u8(tl);
        var clt = new u8(19);
        for (var i2 = 0; i2 < hcLen; ++i2) {
          clt[clim[i2]] = bits(dat, pos + i2 * 3, 7);
        }
        pos += hcLen * 3;
        var clb = max(clt), clbmsk = (1 << clb) - 1;
        var clm = hMap(clt, clb, 1);
        for (var i2 = 0; i2 < tl; ) {
          var r = clm[bits(dat, pos, clbmsk)];
          pos += r & 15;
          var s = r >> 4;
          if (s < 16) {
            ldt[i2++] = s;
          } else {
            var c = 0, n = 0;
            if (s == 16)
              n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i2 - 1];
            else if (s == 17)
              n = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18)
              n = 11 + bits(dat, pos, 127), pos += 7;
            while (n--)
              ldt[i2++] = c;
          }
        }
        var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        lbt = max(lt);
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else
        err(1);
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
    }
    if (resize)
      cbuf(bt + 131072);
    var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    var lpos = pos;
    for (; ; lpos = pos) {
      var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
      if (!c)
        err(2);
      if (sym < 256)
        buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add = sym - 254;
        if (sym > 264) {
          var i2 = sym - 257, b = fleb[i2];
          add = bits(dat, pos, (1 << b) - 1) + fl[i2];
          pos += b;
        }
        var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
        if (!d)
          err(3);
        pos += d & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
        }
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + 131072);
        var end = bt + add;
        if (bt < dt) {
          var shift = dl - dt, dend = Math.min(dt, end);
          if (shift + bt < 0)
            err(3);
          for (; bt < dend; ++bt)
            buf[bt] = dict[shift + bt];
        }
        for (; bt < end; ++bt)
          buf[bt] = buf[bt - dt];
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm)
      final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
var et = /* @__PURE__ */ new u8(0);
var zls = function(d, dict) {
  if ((d[0] & 15) != 8 || d[0] >> 4 > 7 || (d[0] << 8 | d[1]) % 31)
    err(6, "invalid zlib data");
  if ((d[1] >> 5 & 1) == +!dict)
    err(6, "invalid zlib data: " + (d[1] & 32 ? "need" : "unexpected") + " dictionary");
  return (d[1] >> 3 & 4) + 2;
};
var Inflate = /* @__PURE__ */ (function() {
  function Inflate2(opts, cb) {
    if (typeof opts == "function")
      cb = opts, opts = {};
    this.ondata = cb;
    var dict = opts && opts.dictionary && opts.dictionary.subarray(-32768);
    this.s = { i: 0, b: dict ? dict.length : 0 };
    this.o = new u8(32768);
    this.p = new u8(0);
    if (dict)
      this.o.set(dict);
  }
  Inflate2.prototype.e = function(c) {
    if (!this.ondata)
      err(5);
    if (this.d)
      err(4);
    if (!this.p.length)
      this.p = c;
    else if (c.length) {
      var n = new u8(this.p.length + c.length);
      n.set(this.p), n.set(c, this.p.length), this.p = n;
    }
  };
  Inflate2.prototype.c = function(final) {
    this.s.i = +(this.d = final || false);
    var bts = this.s.b;
    var dt = inflt(this.p, this.s, this.o);
    this.ondata(slc(dt, bts, this.s.b), this.d);
    this.o = slc(dt, this.s.b - 32768), this.s.b = this.o.length;
    this.p = slc(this.p, this.s.p / 8 | 0), this.s.p &= 7;
  };
  Inflate2.prototype.push = function(chunk, final) {
    this.e(chunk), this.c(final);
  };
  return Inflate2;
})();
var Unzlib = /* @__PURE__ */ (function() {
  function Unzlib2(opts, cb) {
    Inflate.call(this, opts, cb);
    this.v = opts && opts.dictionary ? 2 : 1;
  }
  Unzlib2.prototype.push = function(chunk, final) {
    Inflate.prototype.e.call(this, chunk);
    if (this.v) {
      if (this.p.length < 6 && !final)
        return;
      this.p = this.p.subarray(zls(this.p, this.v - 1)), this.v = 0;
    }
    if (final) {
      if (this.p.length < 4)
        err(6, "invalid zlib data");
      this.p = this.p.subarray(0, -4);
    }
    Inflate.prototype.c.call(this, final);
  };
  return Unzlib2;
})();
function unzlibSync(data, opts) {
  return inflt(data.subarray(zls(data, opts && opts.dictionary), -4), { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}

// ../image-codecs/node_modules/.pnpm/iobuffer@6.0.1/node_modules/iobuffer/lib/text.js
function decode(bytes, encoding = "utf8") {
  const decoder = new TextDecoder(encoding);
  return decoder.decode(bytes);
}
var encoder = new TextEncoder();
function encode(str) {
  return encoder.encode(str);
}

// ../image-codecs/node_modules/.pnpm/iobuffer@6.0.1/node_modules/iobuffer/lib/iobuffer.js
var defaultByteLength = 1024 * 8;
var hostBigEndian = (() => {
  const array = new Uint8Array(4);
  const view = new Uint32Array(array.buffer);
  return !((view[0] = 1) & array[0]);
})();
var typedArrays = {
  int8: globalThis.Int8Array,
  uint8: globalThis.Uint8Array,
  int16: globalThis.Int16Array,
  uint16: globalThis.Uint16Array,
  int32: globalThis.Int32Array,
  uint32: globalThis.Uint32Array,
  uint64: globalThis.BigUint64Array,
  int64: globalThis.BigInt64Array,
  float32: globalThis.Float32Array,
  float64: globalThis.Float64Array
};
var IOBuffer = class _IOBuffer {
  /**
   * Reference to the internal ArrayBuffer object.
   */
  buffer;
  /**
   * Byte length of the internal ArrayBuffer.
   */
  byteLength;
  /**
   * Byte offset of the internal ArrayBuffer.
   */
  byteOffset;
  /**
   * Byte length of the internal ArrayBuffer.
   */
  length;
  /**
   * The current offset of the buffer's pointer.
   */
  offset;
  lastWrittenByte;
  littleEndian;
  _data;
  _mark;
  _marks;
  /**
   * Create a new IOBuffer.
   * @param data - The data to construct the IOBuffer with.
   * If data is a number, it will be the new buffer's length<br>
   * If data is `undefined`, the buffer will be initialized with a default length of 8Kb<br>
   * If data is an ArrayBuffer, SharedArrayBuffer, an ArrayBufferView (Typed Array), an IOBuffer instance,
   * or a Node.js Buffer, a view will be created over the underlying ArrayBuffer.
   * @param options - An object for the options.
   * @returns A new IOBuffer instance.
   */
  constructor(data = defaultByteLength, options = {}) {
    let dataIsGiven = false;
    if (typeof data === "number") {
      data = new ArrayBuffer(data);
    } else {
      dataIsGiven = true;
      this.lastWrittenByte = data.byteLength;
    }
    const offset = options.offset ? options.offset >>> 0 : 0;
    const byteLength = data.byteLength - offset;
    let dvOffset = offset;
    if (ArrayBuffer.isView(data) || data instanceof _IOBuffer) {
      if (data.byteLength !== data.buffer.byteLength) {
        dvOffset = data.byteOffset + offset;
      }
      data = data.buffer;
    }
    if (dataIsGiven) {
      this.lastWrittenByte = byteLength;
    } else {
      this.lastWrittenByte = 0;
    }
    this.buffer = data;
    this.length = byteLength;
    this.byteLength = byteLength;
    this.byteOffset = dvOffset;
    this.offset = 0;
    this.littleEndian = true;
    this._data = new DataView(this.buffer, dvOffset, byteLength);
    this._mark = 0;
    this._marks = [];
  }
  /**
   * Checks if the memory allocated to the buffer is sufficient to store more
   * bytes after the offset.
   * @param byteLength - The needed memory in bytes.
   * @returns `true` if there is sufficient space and `false` otherwise.
   */
  available(byteLength = 1) {
    return this.offset + byteLength <= this.length;
  }
  /**
   * Check if little-endian mode is used for reading and writing multi-byte
   * values.
   * @returns `true` if little-endian mode is used, `false` otherwise.
   */
  isLittleEndian() {
    return this.littleEndian;
  }
  /**
   * Set little-endian mode for reading and writing multi-byte values.
   * @returns This.
   */
  setLittleEndian() {
    this.littleEndian = true;
    return this;
  }
  /**
   * Check if big-endian mode is used for reading and writing multi-byte values.
   * @returns `true` if big-endian mode is used, `false` otherwise.
   */
  isBigEndian() {
    return !this.littleEndian;
  }
  /**
   * Switches to big-endian mode for reading and writing multi-byte values.
   * @returns This.
   */
  setBigEndian() {
    this.littleEndian = false;
    return this;
  }
  /**
   * Move the pointer n bytes forward.
   * @param n - Number of bytes to skip.
   * @returns This.
   */
  skip(n = 1) {
    this.offset += n;
    return this;
  }
  /**
   * Move the pointer n bytes backward.
   * @param n - Number of bytes to move back.
   * @returns This.
   */
  back(n = 1) {
    this.offset -= n;
    return this;
  }
  /**
   * Move the pointer to the given offset.
   * @param offset - The offset to move to.
   * @returns This.
   */
  seek(offset) {
    this.offset = offset;
    return this;
  }
  /**
   * Store the current pointer offset.
   * @see {@link IOBuffer#reset}
   * @returns This.
   */
  mark() {
    this._mark = this.offset;
    return this;
  }
  /**
   * Move the pointer back to the last pointer offset set by mark.
   * @see {@link IOBuffer#mark}
   * @returns This.
   */
  reset() {
    this.offset = this._mark;
    return this;
  }
  /**
   * Push the current pointer offset to the mark stack.
   * @see {@link IOBuffer#popMark}
   * @returns This.
   */
  pushMark() {
    this._marks.push(this.offset);
    return this;
  }
  /**
   * Pop the last pointer offset from the mark stack, and set the current
   * pointer offset to the popped value.
   * @see {@link IOBuffer#pushMark}
   * @returns This.
   */
  popMark() {
    const offset = this._marks.pop();
    if (offset === void 0) {
      throw new Error("Mark stack empty");
    }
    this.seek(offset);
    return this;
  }
  /**
   * Move the pointer offset back to 0.
   * @returns This.
   */
  rewind() {
    this.offset = 0;
    return this;
  }
  /**
   * Make sure the buffer has sufficient memory to write a given byteLength at
   * the current pointer offset.
   * If the buffer's memory is insufficient, this method will create a new
   * buffer (a copy) with a length that is twice (byteLength + current offset).
   * @param byteLength - The needed memory in bytes.
   * @returns This.
   */
  ensureAvailable(byteLength = 1) {
    if (!this.available(byteLength)) {
      const lengthNeeded = this.offset + byteLength;
      const newLength = lengthNeeded * 2;
      const newArray = new Uint8Array(newLength);
      newArray.set(new Uint8Array(this.buffer));
      this.buffer = newArray.buffer;
      this.length = newLength;
      this.byteLength = newLength;
      this._data = new DataView(this.buffer);
    }
    return this;
  }
  /**
   * Read a byte and return false if the byte's value is 0, or true otherwise.
   * Moves pointer forward by one byte.
   * @returns The read boolean.
   */
  readBoolean() {
    return this.readUint8() !== 0;
  }
  /**
   * Read a signed 8-bit integer and move pointer forward by 1 byte.
   * @returns The read byte.
   */
  readInt8() {
    return this._data.getInt8(this.offset++);
  }
  /**
   * Read an unsigned 8-bit integer and move pointer forward by 1 byte.
   * @returns The read byte.
   */
  readUint8() {
    return this._data.getUint8(this.offset++);
  }
  /**
   * Alias for {@link IOBuffer#readUint8}.
   * @returns The read byte.
   */
  readByte() {
    return this.readUint8();
  }
  /**
   * Read `n` bytes and move pointer forward by `n` bytes.
   * @param n - Number of bytes to read.
   * @returns The read bytes.
   */
  readBytes(n = 1) {
    return this.readArray(n, "uint8");
  }
  /**
   * Creates an array of corresponding to the type `type` and size `size`.
   * For example, type `uint8` will create a `Uint8Array`.
   * @param size - size of the resulting array
   * @param type - number type of elements to read
   * @returns The read array.
   */
  readArray(size, type) {
    const bytes = typedArrays[type].BYTES_PER_ELEMENT * size;
    const offset = this.byteOffset + this.offset;
    const slice = this.buffer.slice(offset, offset + bytes);
    if (this.littleEndian === hostBigEndian && type !== "uint8" && type !== "int8") {
      const slice2 = new Uint8Array(this.buffer.slice(offset, offset + bytes));
      slice2.reverse();
      const returnArray2 = new typedArrays[type](slice2.buffer);
      this.offset += bytes;
      returnArray2.reverse();
      return returnArray2;
    }
    const returnArray = new typedArrays[type](slice);
    this.offset += bytes;
    return returnArray;
  }
  /**
   * Read a 16-bit signed integer and move pointer forward by 2 bytes.
   * @returns The read value.
   */
  readInt16() {
    const value = this._data.getInt16(this.offset, this.littleEndian);
    this.offset += 2;
    return value;
  }
  /**
   * Read a 16-bit unsigned integer and move pointer forward by 2 bytes.
   * @returns The read value.
   */
  readUint16() {
    const value = this._data.getUint16(this.offset, this.littleEndian);
    this.offset += 2;
    return value;
  }
  /**
   * Read a 32-bit signed integer and move pointer forward by 4 bytes.
   * @returns The read value.
   */
  readInt32() {
    const value = this._data.getInt32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }
  /**
   * Read a 32-bit unsigned integer and move pointer forward by 4 bytes.
   * @returns The read value.
   */
  readUint32() {
    const value = this._data.getUint32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }
  /**
   * Read a 32-bit floating number and move pointer forward by 4 bytes.
   * @returns The read value.
   */
  readFloat32() {
    const value = this._data.getFloat32(this.offset, this.littleEndian);
    this.offset += 4;
    return value;
  }
  /**
   * Read a 64-bit floating number and move pointer forward by 8 bytes.
   * @returns The read value.
   */
  readFloat64() {
    const value = this._data.getFloat64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }
  /**
   * Read a 64-bit signed integer number and move pointer forward by 8 bytes.
   * @returns The read value.
   */
  readBigInt64() {
    const value = this._data.getBigInt64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }
  /**
   * Read a 64-bit unsigned integer number and move pointer forward by 8 bytes.
   * @returns The read value.
   */
  readBigUint64() {
    const value = this._data.getBigUint64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }
  /**
   * Read a 1-byte ASCII character and move pointer forward by 1 byte.
   * @returns The read character.
   */
  readChar() {
    return String.fromCharCode(this.readInt8());
  }
  /**
   * Read `n` 1-byte ASCII characters and move pointer forward by `n` bytes.
   * @param n - Number of characters to read.
   * @returns The read characters.
   */
  readChars(n = 1) {
    let result = "";
    for (let i2 = 0; i2 < n; i2++) {
      result += this.readChar();
    }
    return result;
  }
  /**
   * Read the next `n` bytes, return a UTF-8 decoded string and move pointer
   * forward by `n` bytes.
   * @param n - Number of bytes to read.
   * @returns The decoded string.
   */
  readUtf8(n = 1) {
    return decode(this.readBytes(n));
  }
  /**
   * Read the next `n` bytes, return a string decoded with `encoding` and move pointer
   * forward by `n` bytes.
   * If no encoding is passed, the function is equivalent to @see {@link IOBuffer#readUtf8}
   * @param n - Number of bytes to read.
   * @param encoding - The encoding to use. Default is 'utf8'.
   * @returns The decoded string.
   */
  decodeText(n = 1, encoding = "utf8") {
    return decode(this.readBytes(n), encoding);
  }
  /**
   * Write 0xff if the passed value is truthy, 0x00 otherwise and move pointer
   * forward by 1 byte.
   * @param value - The value to write.
   * @returns This.
   */
  writeBoolean(value) {
    this.writeUint8(value ? 255 : 0);
    return this;
  }
  /**
   * Write `value` as an 8-bit signed integer and move pointer forward by 1 byte.
   * @param value - The value to write.
   * @returns This.
   */
  writeInt8(value) {
    this.ensureAvailable(1);
    this._data.setInt8(this.offset++, value);
    this._updateLastWrittenByte();
    return this;
  }
  /**
   * Write `value` as an 8-bit unsigned integer and move pointer forward by 1
   * byte.
   * @param value - The value to write.
   * @returns This.
   */
  writeUint8(value) {
    this.ensureAvailable(1);
    this._data.setUint8(this.offset++, value);
    this._updateLastWrittenByte();
    return this;
  }
  /**
   * An alias for {@link IOBuffer#writeUint8}.
   * @param value - The value to write.
   * @returns This.
   */
  writeByte(value) {
    return this.writeUint8(value);
  }
  /**
   * Write all elements of `bytes` as uint8 values and move pointer forward by
   * `bytes.length` bytes.
   * @param bytes - The array of bytes to write.
   * @returns This.
   */
  writeBytes(bytes) {
    this.ensureAvailable(bytes.length);
    for (let i2 = 0; i2 < bytes.length; i2++) {
      this._data.setUint8(this.offset++, bytes[i2]);
    }
    this._updateLastWrittenByte();
    return this;
  }
  /**
   * Write `value` as a 16-bit signed integer and move pointer forward by 2
   * bytes.
   * @param value - The value to write.
   * @returns This.
   */
  writeInt16(value) {
    this.ensureAvailable(2);
    this._data.setInt16(this.offset, value, this.littleEndian);
    this.offset += 2;
    this._updateLastWrittenByte();
    return this;
  }
  /**
   * Write `value` as a 16-bit unsigned integer and move pointer forward by 2
   * bytes.
   * @param value - The value to write.
   * @returns This.
   */
  writeUint16(value) {
    this.ensureAvailable(2);
    this._data.setUint16(this.offset, value, this.littleEndian);
    this.offset += 2;
    this._updateLastWrittenByte();
    return this;
  }
  /**
   * Write `value` as a 32-bit signed integer and move pointer forward by 4
   * bytes.
   * @param value - The value to write.
   * @returns This.
   */
  writeInt32(value) {
    this.ensureAvailable(4);
    this._data.setInt32(this.offset, value, this.littleEndian);
    this.offset += 4;
    this._updateLastWrittenByte();
    return this;
  }
  /**
   * Write `value` as a 32-bit unsigned integer and move pointer forward by 4
   * bytes.
   * @param value - The value to write.
   * @returns This.
   */
  writeUint32(value) {
    this.ensureAvailable(4);
    this._data.setUint32(this.offset, value, this.littleEndian);
    this.offset += 4;
    this._updateLastWrittenByte();
    return this;
  }
  /**
   * Write `value` as a 32-bit floating number and move pointer forward by 4
   * bytes.
   * @param value - The value to write.
   * @returns This.
   */
  writeFloat32(value) {
    this.ensureAvailable(4);
    this._data.setFloat32(this.offset, value, this.littleEndian);
    this.offset += 4;
    this._updateLastWrittenByte();
    return this;
  }
  /**
   * Write `value` as a 64-bit floating number and move pointer forward by 8
   * bytes.
   * @param value - The value to write.
   * @returns This.
   */
  writeFloat64(value) {
    this.ensureAvailable(8);
    this._data.setFloat64(this.offset, value, this.littleEndian);
    this.offset += 8;
    this._updateLastWrittenByte();
    return this;
  }
  /**
   * Write `value` as a 64-bit signed bigint and move pointer forward by 8
   * bytes.
   * @param value - The value to write.
   * @returns This.
   */
  writeBigInt64(value) {
    this.ensureAvailable(8);
    this._data.setBigInt64(this.offset, value, this.littleEndian);
    this.offset += 8;
    this._updateLastWrittenByte();
    return this;
  }
  /**
   * Write `value` as a 64-bit unsigned bigint and move pointer forward by 8
   * bytes.
   * @param value - The value to write.
   * @returns This.
   */
  writeBigUint64(value) {
    this.ensureAvailable(8);
    this._data.setBigUint64(this.offset, value, this.littleEndian);
    this.offset += 8;
    this._updateLastWrittenByte();
    return this;
  }
  /**
   * Write the charCode of `str`'s first character as an 8-bit unsigned integer
   * and move pointer forward by 1 byte.
   * @param str - The character to write.
   * @returns This.
   */
  writeChar(str) {
    return this.writeUint8(str.charCodeAt(0));
  }
  /**
   * Write the charCodes of all `str`'s characters as 8-bit unsigned integers
   * and move pointer forward by `str.length` bytes.
   * @param str - The characters to write.
   * @returns This.
   */
  writeChars(str) {
    for (let i2 = 0; i2 < str.length; i2++) {
      this.writeUint8(str.charCodeAt(i2));
    }
    return this;
  }
  /**
   * UTF-8 encode and write `str` to the current pointer offset and move pointer
   * forward according to the encoded length.
   * @param str - The string to write.
   * @returns This.
   */
  writeUtf8(str) {
    return this.writeBytes(encode(str));
  }
  /**
   * Export a Uint8Array view of the internal buffer.
   * The view starts at the byte offset and its length
   * is calculated to stop at the last written byte or the original length.
   * @returns A new Uint8Array view.
   */
  toArray() {
    return new Uint8Array(this.buffer, this.byteOffset, this.lastWrittenByte);
  }
  /**
   *  Get the total number of bytes written so far, regardless of the current offset.
   * @returns - Total number of bytes.
   */
  getWrittenByteLength() {
    return this.lastWrittenByte - this.byteOffset;
  }
  /**
   * Update the last written byte offset
   * @private
   */
  _updateLastWrittenByte() {
    if (this.offset > this.lastWrittenByte) {
      this.lastWrittenByte = this.offset;
    }
  }
};

// ../image-codecs/node_modules/.pnpm/fast-png@8.0.0_patch_hash=c_1ada7191b11ba20b728ed8d72f7f7bd4/node_modules/fast-png/lib/helpers/crc.js
var crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 3988292384 ^ c >>> 1;
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}
var initialCrc = 4294967295;
function updateCrc(currentCrc, data, length) {
  let c = currentCrc;
  for (let n = 0; n < length; n++) {
    c = crcTable[(c ^ data[n]) & 255] ^ c >>> 8;
  }
  return c;
}
function crc(data, length) {
  return (updateCrc(initialCrc, data, length) ^ initialCrc) >>> 0;
}
function checkCrc(buffer, crcLength, chunkName) {
  const expectedCrc = buffer.readUint32();
  const actualCrc = crc(new Uint8Array(buffer.buffer, buffer.byteOffset + buffer.offset - crcLength - 4, crcLength), crcLength);
  if (actualCrc !== expectedCrc) {
    throw new Error(`CRC mismatch for chunk ${chunkName}. Expected ${expectedCrc}, found ${actualCrc}`);
  }
}

// ../image-codecs/node_modules/.pnpm/fast-png@8.0.0_patch_hash=c_1ada7191b11ba20b728ed8d72f7f7bd4/node_modules/fast-png/lib/helpers/unfilter.js
function unfilterNone(currentLine, newLine, bytesPerLine) {
  for (let i2 = 0; i2 < bytesPerLine; i2++) {
    newLine[i2] = currentLine[i2];
  }
}
function unfilterSub(currentLine, newLine, bytesPerLine, bytesPerPixel) {
  let i2 = 0;
  for (; i2 < bytesPerPixel; i2++) {
    newLine[i2] = currentLine[i2];
  }
  for (; i2 < bytesPerLine; i2++) {
    newLine[i2] = currentLine[i2] + newLine[i2 - bytesPerPixel] & 255;
  }
}
function unfilterUp(currentLine, newLine, prevLine, bytesPerLine) {
  let i2 = 0;
  if (prevLine.length === 0) {
    for (; i2 < bytesPerLine; i2++) {
      newLine[i2] = currentLine[i2];
    }
  } else {
    for (; i2 < bytesPerLine; i2++) {
      newLine[i2] = currentLine[i2] + prevLine[i2] & 255;
    }
  }
}
function unfilterAverage(currentLine, newLine, prevLine, bytesPerLine, bytesPerPixel) {
  let i2 = 0;
  if (prevLine.length === 0) {
    for (; i2 < bytesPerPixel; i2++) {
      newLine[i2] = currentLine[i2];
    }
    for (; i2 < bytesPerLine; i2++) {
      newLine[i2] = currentLine[i2] + (newLine[i2 - bytesPerPixel] >> 1) & 255;
    }
  } else {
    for (; i2 < bytesPerPixel; i2++) {
      newLine[i2] = currentLine[i2] + (prevLine[i2] >> 1) & 255;
    }
    for (; i2 < bytesPerLine; i2++) {
      newLine[i2] = currentLine[i2] + (newLine[i2 - bytesPerPixel] + prevLine[i2] >> 1) & 255;
    }
  }
}
function unfilterPaeth(currentLine, newLine, prevLine, bytesPerLine, bytesPerPixel) {
  let i2 = 0;
  if (prevLine.length === 0) {
    for (; i2 < bytesPerPixel; i2++) {
      newLine[i2] = currentLine[i2];
    }
    for (; i2 < bytesPerLine; i2++) {
      newLine[i2] = currentLine[i2] + newLine[i2 - bytesPerPixel] & 255;
    }
  } else {
    for (; i2 < bytesPerPixel; i2++) {
      newLine[i2] = currentLine[i2] + prevLine[i2] & 255;
    }
    for (; i2 < bytesPerLine; i2++) {
      newLine[i2] = currentLine[i2] + paethPredictor(newLine[i2 - bytesPerPixel], prevLine[i2], prevLine[i2 - bytesPerPixel]) & 255;
    }
  }
}
function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc)
    return a;
  else if (pb <= pc)
    return b;
  else
    return c;
}

// ../image-codecs/node_modules/.pnpm/fast-png@8.0.0_patch_hash=c_1ada7191b11ba20b728ed8d72f7f7bd4/node_modules/fast-png/lib/helpers/apply_unfilter.js
function applyUnfilter(filterType, currentLine, newLine, prevLine, passLineBytes, bytesPerPixel) {
  switch (filterType) {
    case 0:
      unfilterNone(currentLine, newLine, passLineBytes);
      break;
    case 1:
      unfilterSub(currentLine, newLine, passLineBytes, bytesPerPixel);
      break;
    case 2:
      unfilterUp(currentLine, newLine, prevLine, passLineBytes);
      break;
    case 3:
      unfilterAverage(currentLine, newLine, prevLine, passLineBytes, bytesPerPixel);
      break;
    case 4:
      unfilterPaeth(currentLine, newLine, prevLine, passLineBytes, bytesPerPixel);
      break;
    default:
      throw new Error(`Unsupported filter: ${filterType}`);
  }
}

// ../image-codecs/node_modules/.pnpm/fast-png@8.0.0_patch_hash=c_1ada7191b11ba20b728ed8d72f7f7bd4/node_modules/fast-png/lib/helpers/decode_interlace_adam7.js
var uint16 = new Uint16Array([255]);
var uint8 = new Uint8Array(uint16.buffer);
var osIsLittleEndian = uint8[0] === 255;
function decodeInterlaceAdam7(params) {
  const { data, width, height, channels, depth } = params;
  const passes = [
    { x: 0, y: 0, xStep: 8, yStep: 8 },
    // Pass 1
    { x: 4, y: 0, xStep: 8, yStep: 8 },
    // Pass 2
    { x: 0, y: 4, xStep: 4, yStep: 8 },
    // Pass 3
    { x: 2, y: 0, xStep: 4, yStep: 4 },
    // Pass 4
    { x: 0, y: 2, xStep: 2, yStep: 4 },
    // Pass 5
    { x: 1, y: 0, xStep: 2, yStep: 2 },
    // Pass 6
    { x: 0, y: 1, xStep: 1, yStep: 2 }
    // Pass 7
  ];
  const bytesPerPixel = Math.ceil(depth / 8) * channels;
  const resultData = new Uint8Array(height * width * bytesPerPixel);
  let offset = 0;
  for (let passIndex = 0; passIndex < 7; passIndex++) {
    const pass = passes[passIndex];
    const passWidth = Math.ceil((width - pass.x) / pass.xStep);
    const passHeight = Math.ceil((height - pass.y) / pass.yStep);
    if (passWidth <= 0 || passHeight <= 0)
      continue;
    const passLineBytes = passWidth * bytesPerPixel;
    const prevLine = new Uint8Array(passLineBytes);
    for (let y = 0; y < passHeight; y++) {
      const filterType = data[offset++];
      const currentLine = data.subarray(offset, offset + passLineBytes);
      offset += passLineBytes;
      const newLine = new Uint8Array(passLineBytes);
      applyUnfilter(filterType, currentLine, newLine, prevLine, passLineBytes, bytesPerPixel);
      prevLine.set(newLine);
      for (let x2 = 0; x2 < passWidth; x2++) {
        const outputX = pass.x + x2 * pass.xStep;
        const outputY = pass.y + y * pass.yStep;
        if (outputX >= width || outputY >= height)
          continue;
        for (let i2 = 0; i2 < bytesPerPixel; i2++) {
          resultData[(outputY * width + outputX) * bytesPerPixel + i2] = newLine[x2 * bytesPerPixel + i2];
        }
      }
    }
  }
  if (depth === 16) {
    const uint16Data = new Uint16Array(resultData.buffer);
    if (osIsLittleEndian) {
      for (let k = 0; k < uint16Data.length; k++) {
        uint16Data[k] = swap16(uint16Data[k]);
      }
    }
    return uint16Data;
  } else {
    return resultData;
  }
}
function swap16(val) {
  return (val & 255) << 8 | val >> 8 & 255;
}

// ../image-codecs/node_modules/.pnpm/fast-png@8.0.0_patch_hash=c_1ada7191b11ba20b728ed8d72f7f7bd4/node_modules/fast-png/lib/helpers/decode_interlace_null.js
var uint162 = new Uint16Array([255]);
var uint82 = new Uint8Array(uint162.buffer);
var osIsLittleEndian2 = uint82[0] === 255;
var empty = new Uint8Array(0);
function decodeInterlaceNull(params) {
  const { data, width, height, channels, depth } = params;
  const bytesPerPixel = Math.ceil(depth / 8) * channels;
  const bytesPerLine = Math.ceil(depth / 8 * channels * width);
  const newData = new Uint8Array(height * bytesPerLine);
  let prevLine = empty;
  let offset = 0;
  let currentLine;
  let newLine;
  for (let i2 = 0; i2 < height; i2++) {
    currentLine = data.subarray(offset + 1, offset + 1 + bytesPerLine);
    newLine = newData.subarray(i2 * bytesPerLine, (i2 + 1) * bytesPerLine);
    switch (data[offset]) {
      case 0:
        unfilterNone(currentLine, newLine, bytesPerLine);
        break;
      case 1:
        unfilterSub(currentLine, newLine, bytesPerLine, bytesPerPixel);
        break;
      case 2:
        unfilterUp(currentLine, newLine, prevLine, bytesPerLine);
        break;
      case 3:
        unfilterAverage(currentLine, newLine, prevLine, bytesPerLine, bytesPerPixel);
        break;
      case 4:
        unfilterPaeth(currentLine, newLine, prevLine, bytesPerLine, bytesPerPixel);
        break;
      default:
        throw new Error(`Unsupported filter: ${data[offset]}`);
    }
    prevLine = newLine;
    offset += bytesPerLine + 1;
  }
  if (depth === 16) {
    const uint16Data = new Uint16Array(newData.buffer);
    if (osIsLittleEndian2) {
      for (let k = 0; k < uint16Data.length; k++) {
        uint16Data[k] = swap162(uint16Data[k]);
      }
    }
    return uint16Data;
  } else {
    return newData;
  }
}
function swap162(val) {
  return (val & 255) << 8 | val >> 8 & 255;
}

// ../image-codecs/node_modules/.pnpm/fast-png@8.0.0_patch_hash=c_1ada7191b11ba20b728ed8d72f7f7bd4/node_modules/fast-png/lib/helpers/signature.js
var pngSignature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
function checkSignature(buffer) {
  if (!hasPngSignature(buffer.readBytes(pngSignature.length))) {
    throw new Error("wrong PNG signature");
  }
}
function hasPngSignature(array) {
  if (array.length < pngSignature.length) {
    return false;
  }
  for (let i2 = 0; i2 < pngSignature.length; i2++) {
    if (array[i2] !== pngSignature[i2]) {
      return false;
    }
  }
  return true;
}

// ../image-codecs/node_modules/.pnpm/fast-png@8.0.0_patch_hash=c_1ada7191b11ba20b728ed8d72f7f7bd4/node_modules/fast-png/lib/helpers/text.js
var textChunkName = "tEXt";
var NULL = 0;
var latin1Decoder = new TextDecoder("latin1");
function validateKeyword(keyword) {
  validateLatin1(keyword);
  if (keyword.length === 0 || keyword.length > 79) {
    throw new Error("keyword length must be between 1 and 79");
  }
}
var latin1Regex = /^[\u0000-\u00FF]*$/;
function validateLatin1(text2) {
  if (!latin1Regex.test(text2)) {
    throw new Error("invalid latin1 text");
  }
}
function decodetEXt(text2, buffer, length) {
  const keyword = readKeyword(buffer);
  text2[keyword] = readLatin1(buffer, length - keyword.length - 1);
}
function readKeyword(buffer) {
  buffer.mark();
  while (buffer.readByte() !== NULL) {
  }
  const end = buffer.offset;
  buffer.reset();
  const keyword = latin1Decoder.decode(buffer.readBytes(end - buffer.offset - 1));
  buffer.skip(1);
  validateKeyword(keyword);
  return keyword;
}
function readLatin1(buffer, length) {
  return latin1Decoder.decode(buffer.readBytes(length));
}

// ../image-codecs/node_modules/.pnpm/fast-png@8.0.0_patch_hash=c_1ada7191b11ba20b728ed8d72f7f7bd4/node_modules/fast-png/lib/internal_types.js
var ColorType = {
  UNKNOWN: -1,
  GREYSCALE: 0,
  TRUECOLOUR: 2,
  INDEXED_COLOUR: 3,
  GREYSCALE_ALPHA: 4,
  TRUECOLOUR_ALPHA: 6
};
var CompressionMethod = {
  UNKNOWN: -1,
  DEFLATE: 0
};
var FilterMethod = {
  UNKNOWN: -1,
  ADAPTIVE: 0
};
var InterlaceMethod = {
  UNKNOWN: -1,
  NO_INTERLACE: 0,
  ADAM7: 1
};
var DisposeOpType = {
  NONE: 0,
  BACKGROUND: 1,
  PREVIOUS: 2
};
var BlendOpType = {
  SOURCE: 0,
  OVER: 1
};

// ../image-codecs/node_modules/.pnpm/fast-png@8.0.0_patch_hash=c_1ada7191b11ba20b728ed8d72f7f7bd4/node_modules/fast-png/lib/png_decoder.js
var PngDecoder = class extends IOBuffer {
  _checkCrc;
  _inflator;
  _png;
  _apng;
  _end;
  _hasPalette;
  _palette;
  _hasTransparency;
  _transparency;
  _compressionMethod;
  _filterMethod;
  _interlaceMethod;
  _colorType;
  _isAnimated;
  _numberOfFrames;
  _numberOfPlays;
  _frames;
  _writingDataChunks;
  _chunks;
  _inflatorResult;
  constructor(data, options = {}) {
    super(data);
    const { checkCrc: checkCrc2 = false } = options;
    this._checkCrc = checkCrc2;
    this._inflator = new Unzlib((chunk, final) => {
      this._chunks.push(chunk);
      if (final) {
        const totalLength = this._chunks.reduce((sum, c) => sum + c.length, 0);
        this._inflatorResult = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk2 of this._chunks) {
          this._inflatorResult.set(chunk2, offset);
          offset += chunk2.length;
        }
        this._chunks = [];
      }
    });
    this._chunks = [];
    this._png = {
      width: -1,
      height: -1,
      channels: -1,
      data: new Uint8Array(0),
      depth: 1,
      text: {}
    };
    this._apng = {
      width: -1,
      height: -1,
      channels: -1,
      depth: 1,
      numberOfFrames: 1,
      numberOfPlays: 0,
      text: {},
      frames: []
    };
    this._end = false;
    this._hasPalette = false;
    this._palette = [];
    this._hasTransparency = false;
    this._transparency = new Uint16Array(0);
    this._compressionMethod = CompressionMethod.UNKNOWN;
    this._filterMethod = FilterMethod.UNKNOWN;
    this._interlaceMethod = InterlaceMethod.UNKNOWN;
    this._colorType = ColorType.UNKNOWN;
    this._isAnimated = false;
    this._numberOfFrames = 1;
    this._numberOfPlays = 0;
    this._frames = [];
    this._writingDataChunks = false;
    this._inflatorResult = new Uint8Array(0);
    this.setBigEndian();
  }
  decode() {
    checkSignature(this);
    while (!this._end) {
      const length = this.readUint32();
      const type = this.readChars(4);
      this.decodeChunk(length, type);
    }
    this._inflator.push(new Uint8Array(0), true);
    this.decodeImage();
    return this._png;
  }
  decodeApng() {
    checkSignature(this);
    while (!this._end) {
      const length = this.readUint32();
      const type = this.readChars(4);
      this.decodeApngChunk(length, type);
    }
    this.decodeApngImage();
    return this._apng;
  }
  // https://www.w3.org/TR/PNG/#5Chunk-layout
  decodeChunk(length, type) {
    const offset = this.offset;
    switch (type) {
      // 11.2 Critical chunks
      case "IHDR":
        this.decodeIHDR();
        break;
      case "PLTE":
        this.decodePLTE(length);
        break;
      case "IDAT":
        this.decodeIDAT(length);
        break;
      case "IEND":
        this._end = true;
        break;
      // 11.3 Ancillary chunks
      case "tRNS":
        this.decodetRNS(length);
        break;
      case "iCCP":
        this.decodeiCCP(length);
        break;
      case textChunkName:
        decodetEXt(this._png.text, this, length);
        break;
      case "pHYs":
        this.decodepHYs();
        break;
      default:
        this.skip(length);
        break;
    }
    if (this.offset - offset !== length) {
      throw new Error(`Length mismatch while decoding chunk ${type}`);
    }
    if (this._checkCrc) {
      checkCrc(this, length + 4, type);
    } else {
      this.skip(4);
    }
  }
  decodeApngChunk(length, type) {
    const offset = this.offset;
    if (type !== "fdAT" && type !== "IDAT" && this._writingDataChunks) {
      this.pushDataToFrame();
    }
    switch (type) {
      case "acTL":
        this.decodeACTL();
        break;
      case "fcTL":
        this.decodeFCTL();
        break;
      case "fdAT":
        this.decodeFDAT(length);
        break;
      default:
        this.decodeChunk(length, type);
        this.offset = offset + length;
        break;
    }
    if (this.offset - offset !== length) {
      throw new Error(`Length mismatch while decoding chunk ${type}`);
    }
    if (this._checkCrc) {
      checkCrc(this, length + 4, type);
    } else {
      this.skip(4);
    }
  }
  // https://www.w3.org/TR/PNG/#11IHDR
  decodeIHDR() {
    const image = this._png;
    image.width = this.readUint32();
    image.height = this.readUint32();
    image.depth = checkBitDepth(this.readUint8());
    const colorType = this.readUint8();
    this._colorType = colorType;
    let channels;
    switch (colorType) {
      case ColorType.GREYSCALE:
        channels = 1;
        break;
      case ColorType.TRUECOLOUR:
        channels = 3;
        break;
      case ColorType.INDEXED_COLOUR:
        channels = 1;
        break;
      case ColorType.GREYSCALE_ALPHA:
        channels = 2;
        break;
      case ColorType.TRUECOLOUR_ALPHA:
        channels = 4;
        break;
      // Kept for exhaustiveness.
      // eslint-disable-next-line unicorn/no-useless-switch-case
      case ColorType.UNKNOWN:
      default:
        throw new Error(`Unknown color type: ${colorType}`);
    }
    this._png.channels = channels;
    this._compressionMethod = this.readUint8();
    if (this._compressionMethod !== CompressionMethod.DEFLATE) {
      throw new Error(`Unsupported compression method: ${this._compressionMethod}`);
    }
    this._filterMethod = this.readUint8();
    this._interlaceMethod = this.readUint8();
  }
  decodeACTL() {
    this._numberOfFrames = this.readUint32();
    this._numberOfPlays = this.readUint32();
    this._isAnimated = true;
  }
  decodeFCTL() {
    const image = {
      sequenceNumber: this.readUint32(),
      width: this.readUint32(),
      height: this.readUint32(),
      xOffset: this.readUint32(),
      yOffset: this.readUint32(),
      delayNumber: this.readUint16(),
      delayDenominator: this.readUint16(),
      disposeOp: this.readUint8(),
      blendOp: this.readUint8(),
      data: new Uint8Array(0)
    };
    this._frames.push(image);
  }
  // https://www.w3.org/TR/PNG/#11PLTE
  decodePLTE(length) {
    if (length % 3 !== 0) {
      throw new RangeError(`PLTE field length must be a multiple of 3. Got ${length}`);
    }
    const l = length / 3;
    this._hasPalette = true;
    const palette = [];
    this._palette = palette;
    for (let i2 = 0; i2 < l; i2++) {
      palette.push([this.readUint8(), this.readUint8(), this.readUint8()]);
    }
  }
  // https://www.w3.org/TR/PNG/#11IDAT
  decodeIDAT(length) {
    this._writingDataChunks = true;
    const dataLength = length;
    const dataOffset = this.offset + this.byteOffset;
    try {
      this._inflator.push(new Uint8Array(this.buffer, dataOffset, dataLength), false);
    } catch (error) {
      throw new Error("Error while decompressing the data:", { cause: error });
    }
    this.skip(length);
  }
  decodeFDAT(length) {
    this._writingDataChunks = true;
    let dataLength = length;
    let dataOffset = this.offset + this.byteOffset;
    dataOffset += 4;
    dataLength -= 4;
    try {
      this._inflator.push(new Uint8Array(this.buffer, dataOffset, dataLength), false);
    } catch (error) {
      throw new Error("Error while decompressing the data:", { cause: error });
    }
    this.skip(length);
  }
  // https://www.w3.org/TR/PNG/#11tRNS
  decodetRNS(length) {
    switch (this._colorType) {
      case ColorType.GREYSCALE:
      case ColorType.TRUECOLOUR: {
        const expectedLength = this._colorType === ColorType.GREYSCALE ? 2 : 6;
        if (length !== expectedLength) {
          throw new RangeError(`tRNS chunk length must be ${expectedLength}. Got ${length}`);
        }
        this._hasTransparency = true;
        this._transparency = new Uint16Array(length / 2);
        for (let i2 = 0; i2 < length / 2; i2++) {
          this._transparency[i2] = this.readUint16();
        }
        break;
      }
      case ColorType.INDEXED_COLOUR: {
        if (length > this._palette.length) {
          throw new Error(`tRNS chunk contains more alpha values than there are palette colors (${length} vs ${this._palette.length})`);
        }
        let i2 = 0;
        for (; i2 < length; i2++) {
          const alpha = this.readByte();
          this._palette[i2].push(alpha);
        }
        for (; i2 < this._palette.length; i2++) {
          this._palette[i2].push(255);
        }
        break;
      }
      // Kept for exhaustiveness.
      /* eslint-disable unicorn/no-useless-switch-case */
      case ColorType.UNKNOWN:
      case ColorType.GREYSCALE_ALPHA:
      case ColorType.TRUECOLOUR_ALPHA:
      default: {
        throw new Error(`tRNS chunk is not supported for color type ${this._colorType}`);
      }
    }
  }
  // https://www.w3.org/TR/PNG/#11iCCP
  decodeiCCP(length) {
    const name = readKeyword(this);
    const compressionMethod = this.readUint8();
    if (compressionMethod !== CompressionMethod.DEFLATE) {
      throw new Error(`Unsupported iCCP compression method: ${compressionMethod}`);
    }
    const compressedProfile = this.readBytes(length - name.length - 2);
    this._png.iccEmbeddedProfile = {
      name,
      profile: unzlibSync(compressedProfile)
    };
  }
  // https://www.w3.org/TR/PNG/#11pHYs
  decodepHYs() {
    const ppuX = this.readUint32();
    const ppuY = this.readUint32();
    const unitSpecifier = this.readByte();
    this._png.resolution = {
      x: ppuX,
      y: ppuY,
      unit: unitSpecifier
    };
  }
  decodeApngImage() {
    this._apng.width = this._png.width;
    this._apng.height = this._png.height;
    this._apng.channels = this._png.channels;
    this._apng.depth = this._png.depth;
    this._apng.numberOfFrames = this._numberOfFrames;
    this._apng.numberOfPlays = this._numberOfPlays;
    this._apng.text = this._png.text;
    this._apng.resolution = this._png.resolution;
    for (let i2 = 0; i2 < this._numberOfFrames; i2++) {
      const newFrame = {
        sequenceNumber: this._frames[i2].sequenceNumber,
        delayNumber: this._frames[i2].delayNumber,
        delayDenominator: this._frames[i2].delayDenominator,
        data: this._apng.depth === 8 ? new Uint8Array(this._apng.width * this._apng.height * this._apng.channels) : new Uint16Array(this._apng.width * this._apng.height * this._apng.channels)
      };
      const frame = this._frames.at(i2);
      if (frame) {
        frame.data = decodeInterlaceNull({
          data: frame.data,
          width: frame.width,
          height: frame.height,
          channels: this._apng.channels,
          depth: this._apng.depth
        });
        if (this._hasPalette) {
          this._apng.palette = this._palette;
        }
        if (this._hasTransparency) {
          this._apng.transparency = this._transparency;
        }
        if (i2 === 0 || frame.xOffset === 0 && frame.yOffset === 0 && frame.width === this._png.width && frame.height === this._png.height) {
          newFrame.data = frame.data;
        } else {
          const prevFrame = this._apng.frames.at(i2 - 1);
          this.disposeFrame(frame, prevFrame, newFrame);
          this.addFrameDataToCanvas(newFrame, frame);
        }
        this._apng.frames.push(newFrame);
      }
    }
    return this._apng;
  }
  disposeFrame(frame, prevFrame, imageFrame) {
    switch (frame.disposeOp) {
      case DisposeOpType.NONE:
        break;
      case DisposeOpType.BACKGROUND:
        for (let row = 0; row < this._png.height; row++) {
          for (let col = 0; col < this._png.width; col++) {
            const index = (row * frame.width + col) * this._png.channels;
            for (let channel = 0; channel < this._png.channels; channel++) {
              imageFrame.data[index + channel] = 0;
            }
          }
        }
        break;
      case DisposeOpType.PREVIOUS:
        imageFrame.data.set(prevFrame.data);
        break;
      default:
        throw new Error("Unknown disposeOp");
    }
  }
  addFrameDataToCanvas(imageFrame, frame) {
    const maxValue = 1 << this._png.depth;
    const calculatePixelIndices = (row, col) => {
      const index = ((row + frame.yOffset) * this._png.width + frame.xOffset + col) * this._png.channels;
      const frameIndex = (row * frame.width + col) * this._png.channels;
      return { index, frameIndex };
    };
    switch (frame.blendOp) {
      case BlendOpType.SOURCE:
        for (let row = 0; row < frame.height; row++) {
          for (let col = 0; col < frame.width; col++) {
            const { index, frameIndex } = calculatePixelIndices(row, col);
            for (let channel = 0; channel < this._png.channels; channel++) {
              imageFrame.data[index + channel] = frame.data[frameIndex + channel];
            }
          }
        }
        break;
      // https://www.w3.org/TR/png-3/#13Alpha-channel-processing
      case BlendOpType.OVER:
        for (let row = 0; row < frame.height; row++) {
          for (let col = 0; col < frame.width; col++) {
            const { index, frameIndex } = calculatePixelIndices(row, col);
            for (let channel = 0; channel < this._png.channels; channel++) {
              const sourceAlpha = frame.data[frameIndex + this._png.channels - 1] / maxValue;
              const foregroundValue = channel % (this._png.channels - 1) === 0 ? 1 : frame.data[frameIndex + channel];
              const value = Math.floor(sourceAlpha * foregroundValue + (1 - sourceAlpha) * imageFrame.data[index + channel]);
              imageFrame.data[index + channel] += value;
            }
          }
        }
        break;
      default:
        throw new Error("Unknown blendOp");
    }
  }
  decodeImage() {
    const data = this._inflatorResult;
    if (this._filterMethod !== FilterMethod.ADAPTIVE) {
      throw new Error(`Filter method ${this._filterMethod} not supported`);
    }
    if (this._interlaceMethod === InterlaceMethod.NO_INTERLACE) {
      this._png.data = decodeInterlaceNull({
        data,
        width: this._png.width,
        height: this._png.height,
        channels: this._png.channels,
        depth: this._png.depth
      });
    } else if (this._interlaceMethod === InterlaceMethod.ADAM7) {
      this._png.data = decodeInterlaceAdam7({
        data,
        width: this._png.width,
        height: this._png.height,
        channels: this._png.channels,
        depth: this._png.depth
      });
    } else {
      throw new Error(`Interlace method ${this._interlaceMethod} not supported`);
    }
    if (this._hasPalette) {
      this._png.palette = this._palette;
    }
    if (this._hasTransparency) {
      this._png.transparency = this._transparency;
    }
  }
  pushDataToFrame() {
    this._inflator.push(new Uint8Array(0), true);
    const result = this._inflatorResult;
    const lastFrame = this._frames.at(-1);
    if (lastFrame) {
      lastFrame.data = result;
    } else {
      this._frames.push({
        sequenceNumber: 0,
        width: this._png.width,
        height: this._png.height,
        xOffset: 0,
        yOffset: 0,
        delayNumber: 0,
        delayDenominator: 0,
        disposeOp: DisposeOpType.NONE,
        blendOp: BlendOpType.SOURCE,
        data: result
      });
    }
    this._inflator = new Unzlib((chunk, final) => {
      this._chunks.push(chunk);
      if (final) {
        const totalLength = this._chunks.reduce((sum, c) => sum + c.length, 0);
        this._inflatorResult = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk2 of this._chunks) {
          this._inflatorResult.set(chunk2, offset);
          offset += chunk2.length;
        }
        this._chunks = [];
      }
    });
    this._chunks = [];
    this._writingDataChunks = false;
  }
};
function checkBitDepth(value) {
  if (value !== 1 && value !== 2 && value !== 4 && value !== 8 && value !== 16) {
    throw new Error(`invalid bit depth: ${value}`);
  }
  return value;
}

// ../image-codecs/node_modules/.pnpm/fast-png@8.0.0_patch_hash=c_1ada7191b11ba20b728ed8d72f7f7bd4/node_modules/fast-png/lib/index.js
function decodePng(data, options) {
  const decoder = new PngDecoder(data, options);
  return decoder.decode();
}

// packages/assets/src/png.mjs
var import_inflate = __toESM(require_inflate(), 1);
var import_zstream = __toESM(require_zstream(), 1);
var signature = [137, 80, 78, 71, 13, 10, 26, 10];
var allowedChunks = /* @__PURE__ */ new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND", "sRGB", "gAMA", "cHRM", "pHYs", "tEXt", "tIME"]);
var srgbChromaticity = [31270, 32900, 64e3, 33e3, 3e4, 6e4, 15e3, 6e3];
var typedArrayByteLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength").get;
var typedArraySet = Uint8Array.prototype.set;
var crcTable2 = new Uint32Array(256);
for (let i2 = 0; i2 < 256; i2++) {
  let n = i2;
  for (let bit = 0; bit < 8; bit++) n = n >>> 1 ^ (n & 1 ? 3988292384 : 0);
  crcTable2[i2] = n;
}
function fail(message, quota = false) {
  throw Object.assign(new Error(`PNG: ${message}`), { code: quota ? "QUOTA_EXCEEDED" : "ASSET_BOUNDARY_VIOLATION" });
}
function crc2(bytes, start, end) {
  let n = 4294967295;
  for (let i2 = start; i2 < end; i2++) n = n >>> 8 ^ crcTable2[(n ^ bytes[i2]) & 255];
  return (n ^ 4294967295) >>> 0;
}
function checkInflated(idat, rowBytes, height) {
  const expected = (rowBytes + 1) * height, stream = new import_zstream.default();
  if (import_inflate.default.inflateInit2(stream, 15) !== 0) fail("cannot initialize zlib");
  const scratch = new Uint8Array(16384);
  let assigned = 0, produced = 0;
  try {
    for (; ; ) {
      if (stream.avail_in === 0 && assigned < idat.length) {
        const end = Math.min(assigned + 4096, idat.length);
        stream.input = idat.subarray(assigned, end);
        stream.next_in = 0;
        stream.avail_in = end - assigned;
        assigned = end;
      }
      stream.output = scratch;
      stream.next_out = 0;
      stream.avail_out = Math.min(scratch.length, expected + 1 - produced);
      const before = stream.total_in, status = import_inflate.default.inflate(stream, 0), count = stream.next_out;
      if (produced + count > expected) fail("inflated image exceeds expected size");
      for (let i2 = 0; i2 < count; i2++) if ((produced + i2) % (rowBytes + 1) === 0 && scratch[i2] > 4) fail("invalid row filter");
      produced += count;
      if (status === 1) {
        if (produced !== expected || stream.avail_in !== 0 || assigned !== idat.length) fail("zlib output size or trailing data mismatch");
        return;
      }
      if (status !== 0 || stream.total_in === before && count === 0) fail("invalid, truncated or non-progressing zlib stream");
    }
  } finally {
    import_inflate.default.inflateEnd(stream);
  }
}
function inspect(bytes, maxRgbaBytes) {
  if (signature.some((n, i2) => bytes[i2] !== n)) fail("invalid signature");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const seen = /* @__PURE__ */ new Set(), idats = [];
  let at = 8, count = 0, ancillary = 0, idatLength = 0, phase = 0;
  let width, height, depth, type, channels, rowBytes, palette, transparency;
  while (at < bytes.length) {
    if (++count > 256) fail("too many chunks");
    if (bytes.length - at < 12) fail("truncated chunk");
    const length = view.getUint32(at), start = at + 8, end = start + length;
    if (length > bytes.length - at - 12) fail("chunk length exceeds file");
    const name = String.fromCharCode(...bytes.subarray(at + 4, start));
    if (!allowedChunks.has(name)) fail(`unsupported chunk ${name}`);
    if (crc2(bytes, at + 4, end) !== view.getUint32(end)) fail(`invalid ${name} CRC`);
    if (count === 1 && name !== "IHDR") fail("IHDR must be first");
    if (seen.has(name) && name !== "IDAT" && name !== "tEXt") fail(`duplicate ${name}`);
    if (name !== "IDAT" && phase === 1) phase = 2;
    if ((bytes[at + 4] & 32) !== 0) {
      ancillary += length;
      if (ancillary > 65536) fail("ancillary data exceeds 64 KiB");
    }
    const preData = () => {
      if (phase !== 0) fail(`${name} must precede IDAT`);
    };
    const exact2 = (n) => {
      if (length !== n) fail(`invalid ${name} length`);
    };
    switch (name) {
      case "IHDR":
        exact2(13);
        width = view.getUint32(start);
        height = view.getUint32(start + 4);
        depth = bytes[start + 8];
        type = bytes[start + 9];
        if (width < 1 || height < 1 || width > assetLimits.dimension || height > assetLimits.dimension) fail("dimensions must be 1..512");
        channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
        if (!channels || !(type === 3 ? [1, 2, 4, 8].includes(depth) : depth === 8)) fail("unsupported color type or bit depth");
        if (bytes[start + 10] || bytes[start + 11] || bytes[start + 12]) fail("unsupported compression, filter or interlace mode");
        if (width * height * 4 > maxRgbaBytes) fail("RGBA allocation budget exceeded", true);
        rowBytes = Math.ceil(width * channels * depth / 8);
        break;
      case "PLTE":
        preData();
        if (seen.has("tRNS") || type === 0 || type === 4 || !length || length % 3 || length > 768 || type === 3 && length / 3 > 2 ** depth) fail("invalid palette");
        palette = bytes.subarray(start, end);
        break;
      case "tRNS":
        preData();
        if (type === 3) {
          if (!palette || !length || length > palette.length / 3) fail("invalid palette transparency");
        } else if (type === 0 || type === 2) {
          exact2(type === 0 ? 2 : 6);
          for (let i2 = start; i2 < end; i2 += 2) if (view.getUint16(i2) > 255) fail("color-key transparency exceeds depth");
        } else fail("tRNS cannot accompany an alpha channel");
        transparency = bytes.subarray(start, end);
        break;
      case "IDAT":
        if (phase === 2 || type === 3 && !palette) fail("invalid IDAT ordering or missing palette");
        phase = 1;
        idats.push([start, end]);
        idatLength += length;
        break;
      case "IEND":
        exact2(0);
        if (!seen.has("IDAT") || end + 4 !== bytes.length) fail("missing image data or trailing file data");
        break;
      case "sRGB":
      case "gAMA":
      case "cHRM":
        preData();
        if (seen.has("PLTE")) fail(`${name} must precede PLTE`);
        exact2(name === "sRGB" ? 1 : name === "gAMA" ? 4 : 32);
        if (name === "sRGB" && bytes[start] > 3) fail("invalid sRGB intent");
        if (name === "gAMA" && view.getUint32(start) !== 45455) fail("non-sRGB gamma unsupported");
        if (name === "cHRM" && srgbChromaticity.some((n, i2) => view.getUint32(start + i2 * 4) !== n)) fail("non-sRGB chromaticity unsupported");
        break;
      case "pHYs":
        preData();
        exact2(9);
        if (bytes[start + 8] > 1) fail("invalid physical resolution unit");
        break;
      case "tIME": {
        exact2(7);
        const year = view.getUint16(start), month = bytes[start + 2], day = bytes[start + 3];
        const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (!month || month > 12 || !day || day > days[month - 1] || bytes[start + 4] > 23 || bytes[start + 5] > 59 || bytes[start + 6] > 60) fail("invalid timestamp");
        break;
      }
      case "tEXt": {
        let separator = start;
        while (separator < end && bytes[separator] !== 0) separator++;
        if (separator === start || separator === end || separator - start > 79) fail("invalid text keyword");
        for (let i2 = start; i2 < separator; i2++) {
          const n = bytes[i2];
          if (n < 32 || n > 126 && n < 161 || n === 32 && (i2 === start || i2 === separator - 1 || bytes[i2 - 1] === 32)) fail("invalid text keyword");
        }
        for (let i2 = separator + 1; i2 < end; i2++) if (bytes[i2] === 0) fail("NUL in text data");
        break;
      }
    }
    seen.add(name);
    at = end + 4;
  }
  if (!seen.has("IEND")) fail("missing IEND");
  const idat = new Uint8Array(idatLength);
  let offset = 0;
  for (const [start, end] of idats) {
    idat.set(bytes.subarray(start, end), offset);
    offset += end - start;
  }
  checkInflated(idat, rowBytes, height);
  return { width, height, depth, type, channels, rowBytes, palette, transparency };
}
function decode2(bytes, options = {}) {
  if (!(bytes instanceof Uint8Array)) fail("expected Uint8Array");
  const maxRgbaBytes = options.maxRgbaBytes ?? assetLimits.rgbaBytes;
  if (!Number.isSafeInteger(maxRgbaBytes) || maxRgbaBytes < 0 || maxRgbaBytes > assetLimits.rgbaBytes) fail("invalid RGBA budget");
  const byteLength = Reflect.apply(typedArrayByteLength, bytes, []);
  if (byteLength > assetLimits.imageBytes) fail("file exceeds image byte limit", true);
  const original = new Uint8Array(byteLength);
  Reflect.apply(typedArraySet, original, [bytes]);
  const info = inspect(original, maxRgbaBytes);
  const { width, height, depth, type, channels, rowBytes, palette, transparency } = info;
  const raw = decodePng(original, { checkCrc: true });
  if (raw.width !== width || raw.height !== height || raw.depth !== depth || raw.channels !== channels || !(raw.data instanceof Uint8Array) || raw.data.length !== rowBytes * height) fail("decoder metadata mismatch");
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x2 = 0; x2 < width; x2++) {
    const from = y * rowBytes + x2 * channels, to = (y * width + x2) * 4;
    let r, g, b, a = 255;
    if (type === 3) {
      const index = raw.data[y * rowBytes + Math.floor(x2 * depth / 8)] >>> 8 - depth - x2 * depth % 8 & (1 << depth) - 1;
      if (index >= palette.length / 3) fail("palette index out of bounds");
      r = palette[index * 3];
      g = palette[index * 3 + 1];
      b = palette[index * 3 + 2];
      a = transparency?.[index] ?? 255;
    } else if (type === 0 || type === 4) {
      r = g = b = raw.data[from];
      if (type === 4) a = raw.data[from + 1];
      else if (transparency && r === transparency[1]) a = 0;
    } else {
      r = raw.data[from];
      g = raw.data[from + 1];
      b = raw.data[from + 2];
      if (type === 6) a = raw.data[from + 3];
      else if (transparency && r === transparency[1] && g === transparency[3] && b === transparency[5]) a = 0;
    }
    data[to] = r;
    data[to + 1] = g;
    data[to + 2] = b;
    data[to + 3] = a;
  }
  return { image: { width, height, colorSpace: "srgb", alphaMode: "straight", data }, info: { width, height, byteLength: original.length, rgbaByteLength: data.length } };
}
function decodePng2(bytes, options) {
  try {
    return decode2(bytes, options).image;
  } catch (error) {
    if (error?.code === "QUOTA_EXCEEDED" || error?.code === "ASSET_BOUNDARY_VIOLATION") throw error;
    fail(error?.message ?? "decode failed");
  }
}

// packages/assets/src/jpeg.mjs
var import_decoder = __toESM(require_decoder(), 1);
var typedArrayByteLength2 = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength").get;
var typedArraySet2 = Uint8Array.prototype.set;
function fail2(message, quota = false) {
  throw Object.assign(new Error(`JPEG: ${message}`), { code: quota ? "QUOTA_EXCEEDED" : "ASSET_BOUNDARY_VIOLATION" });
}
function starts(bytes, at, end, text2) {
  if (at + text2.length > end) return false;
  for (let i2 = 0; i2 < text2.length; i2++) if (bytes[at + i2] !== text2.charCodeAt(i2)) return false;
  return true;
}
function orientationFromExif(bytes, start, end) {
  start += 6;
  if (end - start < 8) fail2("truncated EXIF TIFF header");
  const view = new DataView(bytes.buffer, bytes.byteOffset + start, end - start);
  const little = view.getUint16(0) === 18761;
  if (!little && view.getUint16(0) !== 19789) fail2("invalid EXIF byte order");
  if (view.getUint16(2, little) !== 42) fail2("invalid EXIF TIFF magic");
  const ifd = view.getUint32(4, little);
  if (ifd < 8 || ifd > view.byteLength - 2) fail2("EXIF IFD0 outside metadata");
  const entries2 = view.getUint16(ifd, little);
  if (entries2 > 128 || ifd + 2 + entries2 * 12 + 4 > view.byteLength) fail2("invalid or oversized EXIF IFD0");
  let orientation = 1, seen = false;
  for (let i2 = 0; i2 < entries2; i2++) {
    const at = ifd + 2 + i2 * 12;
    if (view.getUint16(at, little) !== 274) continue;
    if (seen || view.getUint16(at + 2, little) !== 3 || view.getUint32(at + 4, little) !== 1) fail2("invalid or duplicate EXIF orientation");
    seen = true;
    orientation = view.getUint16(at + 8, little);
    if (orientation < 1 || orientation > 8) fail2("EXIF orientation must be 1..8");
  }
  const next = view.getUint32(ifd + 2 + entries2 * 12, little);
  if (next !== 0 && (next < 8 || next > view.byteLength - 2)) fail2("EXIF next IFD pointer outside metadata");
  return orientation;
}
function inspect2(bytes, maxRgbaBytes) {
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216) fail2("missing SOI");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  const quant = /* @__PURE__ */ new Map(), huffman = /* @__PURE__ */ new Map();
  let at = 2, markers = 1, metadata = 0, scans = 0, huffmanDefinitions = 0;
  let frame, jfif = false, adobe, exifSeen = false, orientation = 1, restartInterval = 0, ended = false;
  const countMarker = () => {
    if (++markers > 1024) fail2("too many markers");
  };
  while (at < bytes.length) {
    if (bytes[at++] !== 255) fail2("expected marker");
    while (bytes[at] === 255) at++;
    if (at >= bytes.length) fail2("truncated marker");
    const marker = bytes[at++];
    countMarker();
    if (marker === 217) {
      if (!frame || !scans || at !== bytes.length) fail2("empty image or trailing bytes");
      for (const component of frame.components.values()) if (component.approximation.some((n) => n < 0)) fail2("incomplete component scans");
      ended = true;
      break;
    }
    if (marker === 0 || marker === 216 || marker >= 208 && marker <= 215 || at + 2 > bytes.length) fail2("unexpected or truncated marker");
    const length = view.getUint16(at), start = at + 2, end = at + length;
    if (length < 2 || end > bytes.length) fail2("segment length exceeds file");
    const exact2 = (n) => {
      if (length - 2 !== n) fail2("invalid segment length");
    };
    if (marker >= 224 && marker <= 239 || marker === 254) {
      metadata += length - 2;
      if (metadata > 65536) fail2("metadata exceeds 64 KiB");
      if (marker === 224) {
        if (jfif || !starts(bytes, start, end, "JFIF\0") || end - start < 14 || bytes[start + 5] !== 1 || bytes[start + 6] > 2 || bytes[start + 7] > 2 || end - start !== 14 + 3 * bytes[start + 12] * bytes[start + 13]) fail2("unsupported or malformed JFIF");
        jfif = true;
      } else if (marker === 225 && starts(bytes, start, end, "Exif")) {
        if (exifSeen || !starts(bytes, start, end, "Exif\0\0")) fail2("duplicate or malformed EXIF");
        exifSeen = true;
        orientation = orientationFromExif(bytes, start, end);
      } else if (marker === 226 && starts(bytes, start, end, "ICC_PROFILE")) {
        fail2("ICC profiles unsupported; export sRGB without an embedded ICC profile");
      } else if (marker === 238) {
        exact2(12);
        if (adobe !== void 0 || !starts(bytes, start, end, "Adobe") || view.getUint16(start + 5) !== 100 || bytes[start + 11] > 1) fail2("unsupported Adobe color transform");
        adobe = bytes[start + 11];
      }
    } else if (marker === 192 || marker === 194) {
      if (frame || length < 8) fail2("duplicate or truncated frame");
      const height = view.getUint16(start + 1), width = view.getUint16(start + 3), count = bytes[start + 5];
      exact2(6 + count * 3);
      if (bytes[start] !== 8 || ![1, 3].includes(count)) fail2("only 8-bit grayscale and three-component JPEG supported");
      if (width < 1 || height < 1 || width > 512 || height > 512) fail2("dimensions must be 1..512");
      if (width * height * 4 > maxRgbaBytes) fail2("RGBA allocation budget exceeded", true);
      const components = /* @__PURE__ */ new Map();
      let maxH = 1, maxV = 1, blocks = 0;
      for (let i2 = 0; i2 < count; i2++) {
        const offset = start + 6 + i2 * 3, id = bytes[offset], h = bytes[offset + 1] >>> 4, v = bytes[offset + 1] & 15, q = bytes[offset + 2];
        if (components.has(id) || h < 1 || h > 2 || v < 1 || v > 2 || q > 3) fail2("invalid component sampling or selector");
        maxH = Math.max(maxH, h);
        maxV = Math.max(maxV, v);
        blocks += h * v;
        components.set(id, { id, h, v, q, approximation: new Int8Array(64).fill(-1) });
      }
      if (blocks > 10 || count === 1 && (maxH !== 1 || maxV !== 1)) fail2("unsupported MCU sampling mode");
      frame = { width, height, components, maxH, maxV, progressive: marker === 194 };
    } else if (marker === 219) {
      if (scans) fail2("quantization tables must precede scans");
      let p = start;
      while (p < end) {
        const selector = bytes[p++], precision = selector >>> 4, id = selector & 15, size = precision === 0 ? 64 : 128;
        if (precision > 1 || id > 3 || quant.has(id) || p + size > end) fail2("invalid or duplicate quantization table");
        for (let i2 = 0; i2 < 64; i2++) if ((precision === 0 ? bytes[p + i2] : view.getUint16(p + i2 * 2)) === 0) fail2("zero quantization value");
        quant.set(id, precision);
        p += size;
      }
      if (start === end) fail2("empty quantization segment");
    } else if (marker === 196) {
      let p = start;
      while (p < end) {
        if (++huffmanDefinitions > 128 || end - p < 17) fail2("invalid or excessive Huffman tables");
        const selector = bytes[p++], kind = selector >>> 4, id = selector & 15;
        if (kind > 1 || id > 3) fail2("invalid Huffman selector");
        let symbols = 0, slots = 1;
        for (let i2 = 0; i2 < 16; i2++) {
          const count = bytes[p++];
          symbols += count;
          slots = slots * 2 - count;
          if (slots <= 0) fail2("oversubscribed Huffman codes or forbidden all-ones code");
        }
        if (!symbols || symbols > 256 || p + symbols > end) fail2("invalid Huffman table size");
        const values2 = /* @__PURE__ */ new Set();
        let baselineCompatible = true;
        for (let i2 = 0; i2 < symbols; i2++) {
          const symbol = bytes[p++];
          if (values2.has(symbol) || (kind === 0 ? symbol > 11 : (symbol & 15) > 10)) fail2("invalid Huffman symbol");
          values2.add(symbol);
          if (kind === 1 && (symbol & 15) === 0 && symbol !== 0 && symbol !== 240) baselineCompatible = false;
        }
        huffman.set(selector, { baselineCompatible });
      }
      if (start === end) fail2("empty Huffman segment");
    } else if (marker === 221) {
      exact2(2);
      restartInterval = view.getUint16(start);
    } else if (marker === 218) {
      if (!frame || ++scans > 16 || start === end) fail2("missing frame or excessive scans");
      const count = bytes[start];
      exact2(1 + count * 2 + 3);
      if (count < 1 || count > frame.components.size) fail2("invalid scan component count");
      const ss = bytes[end - 3], se = bytes[end - 2], ah = bytes[end - 1] >>> 4, al = bytes[end - 1] & 15;
      if (ss > se || se > 63 || ah > 13 || al > 13 || ah !== 0 && ah !== al + 1) fail2("invalid spectral or approximation range");
      if (!frame.progressive && (ss !== 0 || se !== 63 || ah || al)) fail2("invalid baseline scan");
      if (frame.progressive && (ss === 0 && se !== 0 || ss > 0 && count !== 1)) fail2("invalid progressive scan");
      const selected = [], ids2 = /* @__PURE__ */ new Set();
      for (let i2 = 0; i2 < count; i2++) {
        const id = bytes[start + 1 + i2 * 2], selector = bytes[start + 2 + i2 * 2], dc = selector >>> 4, ac = selector & 15;
        const component = frame.components.get(id);
        if (!component || ids2.has(id) || dc > 3 || ac > 3 || !quant.has(component.q) || !frame.progressive && quant.get(component.q) !== 0) fail2("invalid scan selector or missing quantization table");
        if (ss === 0 && ah === 0 && !huffman.has(dc) || se > 0 && !huffman.has(16 | ac)) fail2("missing Huffman table");
        if (!frame.progressive && !huffman.get(16 | ac).baselineCompatible) fail2("invalid baseline Huffman symbol");
        if (ss > 0 && component.approximation[0] < 0) fail2("AC scan before DC");
        for (let k = ss; k <= se; k++) {
          if (component.approximation[k] !== (ah === 0 ? -1 : ah)) fail2("duplicate or out-of-order progressive band");
          component.approximation[k] = al;
        }
        ids2.add(id);
        selected.push(component);
      }
      let p = end, restarts = 0, entropyStart = end;
      while (p < bytes.length) {
        if (bytes[p++] !== 255) continue;
        const prefix = p - 1;
        if (p >= bytes.length) fail2("truncated entropy marker");
        if (bytes[p] === 0) {
          p++;
          continue;
        }
        while (bytes[p] === 255) p++;
        const next = bytes[p];
        if (next >= 208 && next <= 215) {
          countMarker();
          if (!restartInterval || next !== 208 + restarts % 8 || prefix === entropyStart) fail2("invalid restart sequence");
          restarts++;
          p++;
          entropyStart = p;
          continue;
        }
        if (prefix === entropyStart || next === 0 || p >= bytes.length) fail2("empty or malformed entropy segment");
        p = prefix;
        break;
      }
      if (p >= bytes.length) fail2("unterminated entropy scan");
      const units = count === 1 ? Math.ceil(Math.ceil(frame.width / 8) * selected[0].h / frame.maxH) * Math.ceil(Math.ceil(frame.height / 8) * selected[0].v / frame.maxV) : Math.ceil(frame.width / (8 * frame.maxH)) * Math.ceil(frame.height / (8 * frame.maxV));
      if (restarts !== (restartInterval ? Math.floor((units - 1) / restartInterval) : 0)) fail2("restart count does not match MCU budget");
      at = p;
      continue;
    } else fail2(`unsupported marker 0x${marker.toString(16)}`);
    at = end;
  }
  if (!ended) fail2("missing EOI");
  if (adobe !== void 0 && frame.components.size !== 3) fail2("Adobe transform requires three components");
  if (jfif && adobe === 0) fail2("conflicting JFIF and RGB color declarations");
  const ids = [...frame.components.keys()].join(",");
  if (frame.components.size === 3 && !jfif && adobe === void 0 && ids !== "1,2,3") fail2("ambiguous three-component color transform");
  return { ...frame, orientation, colorTransform: adobe !== 0 };
}
function decode3(bytes, options = {}) {
  if (!(bytes instanceof Uint8Array)) fail2("expected Uint8Array");
  const maxRgbaBytes = options.maxRgbaBytes ?? assetLimits.rgbaBytes;
  if (!Number.isSafeInteger(maxRgbaBytes) || maxRgbaBytes < 0 || maxRgbaBytes > assetLimits.rgbaBytes) fail2("invalid RGBA budget");
  const byteLength = Reflect.apply(typedArrayByteLength2, bytes, []);
  if (byteLength > assetLimits.imageBytes) fail2("file exceeds image byte limit", true);
  const original = new Uint8Array(byteLength);
  Reflect.apply(typedArraySet2, original, [bytes]);
  const info = inspect2(original, maxRgbaBytes);
  const raw = (0, import_decoder.default)(original, { useTArray: true, formatAsRGBA: true, tolerantDecoding: false, maxResolutionInMP: 0.262144, maxMemoryUsageInMB: 32, colorTransform: info.colorTransform });
  if (raw.width !== info.width || raw.height !== info.height || !(raw.data instanceof Uint8Array) || raw.data.length !== info.width * info.height * 4) fail2("decoder output mismatch");
  for (let i2 = 3; i2 < raw.data.length; i2 += 4) if (raw.data[i2] !== 255) fail2("JPEG decoder returned nonopaque alpha");
  const swapped = info.orientation >= 5, width = swapped ? info.height : info.width, height = swapped ? info.width : info.height;
  let data = raw.data;
  if (info.orientation !== 1) {
    data = new Uint8Array(raw.data.length);
    for (let y = 0; y < info.height; y++) for (let x2 = 0; x2 < info.width; x2++) {
      let ox, oy;
      switch (info.orientation) {
        case 2:
          ox = info.width - 1 - x2;
          oy = y;
          break;
        case 3:
          ox = info.width - 1 - x2;
          oy = info.height - 1 - y;
          break;
        case 4:
          ox = x2;
          oy = info.height - 1 - y;
          break;
        case 5:
          ox = y;
          oy = x2;
          break;
        case 6:
          ox = info.height - 1 - y;
          oy = x2;
          break;
        case 7:
          ox = info.height - 1 - y;
          oy = info.width - 1 - x2;
          break;
        case 8:
          ox = y;
          oy = info.width - 1 - x2;
          break;
      }
      const from = (y * info.width + x2) * 4, to = (oy * width + ox) * 4;
      for (let c = 0; c < 4; c++) data[to + c] = raw.data[from + c];
    }
  }
  return { image: { width, height, colorSpace: "srgb", alphaMode: "straight", data }, info: { width, height, byteLength, rgbaByteLength: data.length } };
}
function decodeJpeg(bytes, options) {
  try {
    return decode3(bytes, options).image;
  } catch (error) {
    if (error?.code === "QUOTA_EXCEEDED" || error?.code === "ASSET_BOUNDARY_VIOLATION") throw error;
    fail2(error?.message ?? "decode failed");
  }
}

// packages/assets/src/index.mjs
var admissions = /* @__PURE__ */ new WeakMap();
var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var sourceFields = ["mediaType", "encoding", "data"];
var derivedFields = [...sourceFields, "byteLength", "sha256", "width", "height"];
function fail3(message, path, quota = false) {
  throw Object.assign(new Error(path === void 0 ? message : `${message}: ${path}`), {
    code: quota ? "QUOTA_EXCEEDED" : "ASSET_BOUNDARY_VIOLATION",
    ...path === void 0 ? {} : { path }
  });
}
function dataRecord(value, fields, path) {
  if (!value || typeof value !== "object") fail3("Expected a plain asset data record", path);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail3("Expected a plain asset data record", path);
  const keys = Reflect.ownKeys(value);
  if (fields && (keys.length !== fields.length || fields.some((key) => !keys.includes(key)))) fail3("Missing or unsupported asset fields", path);
  const snapshot = /* @__PURE__ */ Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== "string" || !descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value") || fields && !fields.includes(key)) fail3("Asset fields must be enumerable own data properties", path);
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}
function validateAssetPath(path) {
  if (typeof path !== "string" || path.length > assetLimits.pathCharacters || !/^assets\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:bmp|png|jpg|jpeg)$/.test(path)) fail3("Invalid logical image asset path", typeof path === "string" ? path : void 0);
  for (const segment of path.split("/")) {
    if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment) || /^__lux/i.test(segment)) fail3("Reserved asset path", path);
  }
  return path;
}
function validateMedia(path, descriptor) {
  const expected = path.endsWith(".bmp") ? "image/bmp" : path.endsWith(".png") ? "image/png" : "image/jpeg";
  if (descriptor.mediaType !== expected || descriptor.encoding !== "base64") fail3("Image extension/media type must match and encoding must be base64", path);
}
function decodeCanonicalBase64(data) {
  if (typeof data !== "string" || !data.length) fail3("Asset base64 must be a nonempty string");
  if (data.length > Math.ceil(assetLimits.imageBytes / 3) * 4) fail3("Encoded asset exceeds image byte limit", void 0, true);
  if (data.length % 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) fail3("Asset base64 is not canonical");
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  const length = data.length / 4 * 3 - padding;
  if (!length || length > assetLimits.imageBytes) fail3("Decoded asset exceeds image byte limit", void 0, true);
  const bytes = new Uint8Array(length);
  let at = 0;
  for (let i2 = 0; i2 < data.length; i2 += 4) {
    const a = alphabet.indexOf(data[i2]), b = alphabet.indexOf(data[i2 + 1]);
    const c = data[i2 + 2] === "=" ? 0 : alphabet.indexOf(data[i2 + 2]);
    const d = data[i2 + 3] === "=" ? 0 : alphabet.indexOf(data[i2 + 3]);
    bytes[at++] = a << 2 | b >> 4;
    if (at < length) bytes[at++] = b << 4 | c >> 2;
    if (at < length) bytes[at++] = c << 6 | d;
  }
  let encoded = "";
  for (let i2 = 0; i2 < length; i2 += 3) {
    const a = bytes[i2], b = bytes[i2 + 1] ?? 0, c = bytes[i2 + 2] ?? 0;
    encoded += alphabet[a >> 2] + alphabet[(a & 3) << 4 | b >> 4] + (i2 + 1 < length ? alphabet[(b & 15) << 2 | c >> 6] : "=") + (i2 + 2 < length ? alphabet[c & 63] : "=");
  }
  if (encoded !== data) fail3("Asset base64 has noncanonical pad bits");
  return bytes;
}
function validateBmp(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 54) fail3("Truncated BMP header");
  if (bytes.byteLength > assetLimits.imageBytes) fail3("BMP exceeds image byte limit", void 0, true);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] !== 66 || bytes[1] !== 77 || view.getUint32(2, true) !== bytes.byteLength || view.getUint16(6, true) || view.getUint16(8, true) || view.getUint32(10, true) !== 54 || view.getUint32(14, true) !== 40) fail3("Unsupported BMP file header");
  const width = view.getInt32(18, true), height = view.getInt32(22, true);
  if (width < 1 || height < 1 || width > assetLimits.dimension || height > assetLimits.dimension) fail3("BMP dimensions must be positive and at most 512");
  if (view.getUint16(26, true) !== 1 || view.getUint16(28, true) !== 24 || view.getUint32(30, true) !== 0 || view.getUint32(46, true) || view.getUint32(50, true)) fail3("BMP must be opaque 24-bit BI_RGB without a palette");
  const stride = Math.ceil(width * 3 / 4) * 4, payload = stride * height, rgbaByteLength = width * height * 4;
  if (!Number.isSafeInteger(payload) || !Number.isSafeInteger(rgbaByteLength) || bytes.byteLength !== 54 + payload || view.getUint32(34, true) !== 0 && view.getUint32(34, true) !== payload) fail3("BMP pixel payload size mismatch");
  return { width, height, stride, byteLength: bytes.byteLength, rgbaByteLength };
}
function decodeBmp(bytes) {
  const { width, height, stride, rgbaByteLength } = validateBmp(bytes);
  const data = new Uint8Array(rgbaByteLength);
  for (let y = 0; y < height; y++) for (let x2 = 0; x2 < width; x2++) {
    const from = 54 + (height - 1 - y) * stride + x2 * 3, to = (y * width + x2) * 4;
    data[to] = bytes[from + 2];
    data[to + 1] = bytes[from + 1];
    data[to + 2] = bytes[from];
    data[to + 3] = 255;
  }
  return { width, height, data };
}
function admit(input, derived = false) {
  if (!derived && admissions.has(input)) return admissions.get(input);
  const records = dataRecord(input), keys = Object.keys(records);
  if (keys.length > assetLimits.count) fail3("At most four image assets are supported", void 0, true);
  keys.sort();
  const seen = /* @__PURE__ */ new Set(), result = {}, decoded = [];
  let totalBytes = 0, totalRgba = 0;
  for (const path of keys) {
    validateAssetPath(path);
    if (seen.has(path.toLowerCase())) fail3("Case-fold asset path collision", path);
    seen.add(path.toLowerCase());
    const descriptor = dataRecord(records[path], derived ? derivedFields : sourceFields, path);
    validateMedia(path, descriptor);
    let bytes, info, pixels;
    try {
      bytes = decodeCanonicalBase64(descriptor.data);
      if (totalBytes + bytes.byteLength > assetLimits.totalBytes) fail3("Aggregate asset byte budget exceeded", path, true);
      if (descriptor.mediaType === "image/bmp") {
        info = validateBmp(bytes);
        if (info.rgbaByteLength > assetLimits.rgbaBytes - totalRgba) fail3("Aggregate decoded image budget exceeded", path, true);
        pixels = { ...decodeBmp(bytes), colorSpace: "srgb", alphaMode: "straight" };
      } else {
        pixels = (descriptor.mediaType === "image/png" ? decodePng2 : decodeJpeg)(bytes, { maxRgbaBytes: assetLimits.rgbaBytes - totalRgba });
        info = { width: pixels.width, height: pixels.height, byteLength: bytes.byteLength, rgbaByteLength: pixels.data.byteLength };
      }
    } catch (error) {
      fail3(error.message, path, error.code === "QUOTA_EXCEEDED");
    }
    totalBytes += info.byteLength;
    totalRgba += info.rgbaByteLength;
    if (totalBytes > assetLimits.totalBytes || totalRgba > assetLimits.rgbaBytes) fail3("Aggregate asset byte budget exceeded", path, true);
    const normalized = { mediaType: descriptor.mediaType, encoding: "base64", data: descriptor.data };
    if (derived) {
      if (descriptor.byteLength !== info.byteLength || descriptor.width !== info.width || descriptor.height !== info.height || typeof descriptor.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(descriptor.sha256)) fail3("Invalid derived asset metadata", path);
      Object.assign(normalized, { byteLength: info.byteLength, sha256: descriptor.sha256, width: info.width, height: info.height });
    }
    result[path] = Object.freeze(normalized);
    decoded.push({ path, bytes, info, pixels });
  }
  const admission = { assets: Object.freeze(result), decoded };
  if (!derived) admissions.set(admission.assets, admission);
  return admission;
}
function identity(assets) {
  return JSON.stringify(Object.keys(assets).sort().map((path) => {
    const { mediaType, byteLength, sha256, width, height } = assets[path];
    return { path, mediaType, byteLength, sha256, width, height };
  }));
}
function canonicalAssetSet(assets) {
  return identity(admit(assets, true).assets);
}

// apps/build-worker/src/sdk-selection.mjs
var entries = Object.freeze({ "0.1.0": "index.ts", "0.2.0": "sdk-v2.ts" });

// apps/build-worker/src/source-policy.mjs
var limits = Object.freeze({ sourceBytes: 1048576, files: 32, diagnosticBytes: 131072, compileMs: 3e4, outputBytes: 4194304, sourceJsonBytes: 6291456, requestBytes: 8388608 });
function violation(message, code = "SOURCE_BOUNDARY_VIOLATION") {
  return Object.assign(new Error(message), { code });
}
function snapshotRecord(value, fields) {
  if (!value || typeof value !== "object") throw violation("Expected plain data record");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw violation("Expected plain data record");
  const keys = Reflect.ownKeys(value), result = /* @__PURE__ */ Object.create(null);
  if (fields && (keys.length !== fields.length || fields.some((key) => !keys.includes(key)))) throw violation("Missing or unsupported fields");
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== "string" || !descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) throw violation("Expected enumerable own data properties");
    result[key] = descriptor.value;
  }
  return result;
}

// packages/runtime-contracts/src/parameters.mjs
var parameterLimits = Object.freeze({ count: 32, metadataBytes: 32768, id: 64, label: 80, unit: 24 });
var requiredFields = ["type", "label", "default", "min", "max"];
var optionalFields = ["step", "unit"];
var reservedIds = /* @__PURE__ */ new Set(["constructor", "prototype", "__proto__"]);
var encoder2 = new TextEncoder();
function invalid(path, message) {
  throw Object.assign(new Error(`${path}: ${message}`), { code: "INVALID_PARAMETERS", path });
}
function record(input, path) {
  if (!input || typeof input !== "object") invalid(path, "expected a plain data record");
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== null && prototype !== Object.prototype) invalid(path, "expected a plain data record");
  const result = /* @__PURE__ */ Object.create(null);
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (typeof key !== "string" || !descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) {
      invalid(path, "expected enumerable own data properties");
    }
    result[key] = descriptor.value;
  }
  return result;
}
function controlId(id) {
  if (typeof id !== "string" || !/^[a-z][A-Za-z0-9_]{0,63}$/.test(id) || reservedIds.has(id)) {
    invalid("controls", "invalid control ID");
  }
  return id;
}
function text(value, path, maximum) {
  if (typeof value !== "string" || !value.isWellFormed() || /[\u0000-\u001f\u007f-\u009f]/.test(value)) {
    invalid(path, "expected valid Unicode without control characters");
  }
  const normalized = value.trim();
  if (!normalized || [...normalized].length > maximum) invalid(path, `expected 1\u2013${maximum} code points`);
  return normalized;
}
function finite(value, path) {
  if (typeof value !== "number" || !Number.isFinite(value)) invalid(path, "expected a finite number");
  return Object.is(value, -0) ? 0 : value;
}
function definition(id, input, normalizedRow) {
  const path = `controls.${controlId(id)}`, raw = record(input, path);
  const required = normalizedRow ? ["id", ...requiredFields, "changeCost"] : requiredFields;
  for (const key of required) if (!Object.hasOwn(raw, key)) invalid(path, `missing field ${key}`);
  for (const key of Object.keys(raw)) if (!required.includes(key) && !optionalFields.includes(key)) invalid(path, `unsupported field ${key.slice(0, 80)}`);
  if (normalizedRow && raw.changeCost !== "live") invalid(path, "changeCost must be live");
  if (raw.type !== "number") invalid(path, "only number controls are supported");
  const label = text(raw.label, `${path}.label`, parameterLimits.label);
  const minimum = finite(raw.min, `${path}.min`), maximum = finite(raw.max, `${path}.max`);
  const value = finite(raw.default, `${path}.default`);
  if (!(minimum < maximum) || !Number.isFinite(maximum - minimum)) invalid(path, "min must be below max with a finite range");
  if (value < minimum || value > maximum) invalid(`${path}.default`, `expected a number from ${minimum} to ${maximum}`);
  const result = { id, type: "number", label, default: value, min: minimum, max: maximum };
  if (Object.hasOwn(raw, "step")) {
    const step = finite(raw.step, `${path}.step`);
    if (step <= 0 || step > maximum - minimum) invalid(`${path}.step`, "expected a positive increment no greater than the range");
    result.step = step;
  }
  if (Object.hasOwn(raw, "unit")) result.unit = text(raw.unit, `${path}.unit`, parameterLimits.unit);
  result.changeCost = "live";
  return Object.freeze(result);
}
function finishSchema(rows) {
  if (encoder2.encode(JSON.stringify(rows)).byteLength > parameterLimits.metadataBytes) invalid("controls", "schema exceeds 32 KiB UTF-8");
  return Object.freeze(rows);
}
function normalizeControlSchema(input) {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) invalid("controls", "expected a plain array of control definitions");
  const length = Object.getOwnPropertyDescriptor(input, "length").value;
  if (length > parameterLimits.count) invalid("controls", "at most 32 controls are supported");
  if (Reflect.ownKeys(input).length !== length + 1) invalid("controls", "unexpected array properties");
  const rows = [], ids = /* @__PURE__ */ new Set();
  for (let i2 = 0; i2 < length; i2++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(i2));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) invalid("controls", "expected dense own data array elements");
    const raw = record(descriptor.value, `controls[${i2}]`);
    const id = controlId(raw.id);
    if (ids.has(id)) invalid("controls", `duplicate control ID ${id}`);
    ids.add(id);
    rows.push(definition(id, raw, true));
  }
  return finishSchema(rows);
}
function canonicalControlSchemaJson(schema) {
  return JSON.stringify(normalizeControlSchema(schema));
}
function values(schema, input, complete) {
  const definitions = normalizeControlSchema(schema), raw = record(input, "values"), keys = Object.keys(raw);
  if (!complete && !keys.length) invalid("values", "expected a nonempty parameter patch");
  const known = new Map(definitions.map((control) => [control.id, control]));
  for (const id of keys) if (!known.has(id)) invalid(`values.${id.slice(0, 64)}`, "unknown parameter ID");
  const result = {};
  for (const control of definitions) {
    const path = `values.${control.id}`;
    if (!Object.hasOwn(raw, control.id)) {
      if (complete) invalid(path, "missing parameter in full snapshot");
      continue;
    }
    const value = finite(raw[control.id], path);
    if (value < control.min || value > control.max) invalid(path, `expected a number from ${control.min} to ${control.max}`);
    result[control.id] = value;
  }
  return Object.freeze(result);
}
function validateControlSnapshot(schema, input) {
  return values(schema, input, true);
}

// apps/build-worker/src/artifact-identity.mjs
var hashPattern = /^[a-f0-9]{64}$/;
var linkedFields = ["code", "sourceMap", "bundleHash", "linker"];
function exact(input, fields, versionKey, identityKey) {
  const raw = snapshotRecord(input), versioned = Object.hasOwn(raw, versionKey);
  if (versioned && ![2, 3].includes(raw[versionKey])) throw violation(`Unsupported ${versionKey}`);
  const allowed = [...fields, ...versioned ? [versionKey, "assets", "assetSetHash"] : [], ...raw[versionKey] === 3 ? ["controls", "controlSchemaHash"] : [], ...Object.hasOwn(raw, identityKey) ? [identityKey] : []];
  if (Object.keys(raw).length !== allowed.length || allowed.some((key) => !Object.hasOwn(raw, key))) throw violation("Missing or unsupported identity fields");
  return raw;
}
function requireHash(hash) {
  if (typeof hash !== "string" || !hashPattern.test(hash)) throw violation("Invalid SHA-256 identity");
}
function parameterFields(a) {
  requireHash(a.controlSchemaHash);
  try {
    return { controls: normalizeControlSchema(a.controls), controlSchemaHash: a.controlSchemaHash };
  } catch (error) {
    throw violation(error.message);
  }
}
function linkedBody(input) {
  const a = exact(input, linkedFields, "linkedVersion", "linkedHash");
  if (typeof a.code !== "string" || !a.code.isWellFormed() || typeof a.sourceMap !== "string" || !a.sourceMap.isWellFormed()) throw violation("Invalid linked code or source map");
  requireHash(a.bundleHash);
  const linker = snapshotRecord(a.linker, ["version", "implementationHash", "apiHash", "binaryHash"]);
  if (linker.version !== "0.28.2") throw violation("Unsupported linker version");
  for (const key of ["implementationHash", "apiHash", "binaryHash"]) requireHash(linker[key]);
  const body = { code: a.code, sourceMap: a.sourceMap, bundleHash: a.bundleHash, linker: { version: linker.version, implementationHash: linker.implementationHash, apiHash: linker.apiHash, binaryHash: linker.binaryHash } };
  if (a.linkedVersion === 3) return { linkedVersion: 3, ...body, assets: a.assets, assetSetHash: a.assetSetHash, ...parameterFields(a) };
  return a.linkedVersion === 2 ? { linkedVersion: 2, ...body, assets: a.assets, assetSetHash: a.assetSetHash } : body;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  canonicalAssetSet,
  canonicalControlSchemaJson,
  decodeCanonicalBase64,
  linkedBody,
  normalizeControlSchema,
  validateControlSnapshot
});
