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

// ../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/adler32.js
var require_adler32 = __commonJS({
  "../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/adler32.js"(exports, module) {
    "use strict";
    var adler32 = (adler2, buf, len, pos) => {
      let s1 = adler2 & 65535 | 0, s2 = adler2 >>> 16 & 65535 | 0, n = 0;
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
    module.exports = adler32;
  }
});

// ../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/crc32.js
var require_crc32 = __commonJS({
  "../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/crc32.js"(exports, module) {
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
    module.exports = crc32;
  }
});

// ../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/inffast.js
var require_inffast = __commonJS({
  "../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/inffast.js"(exports, module) {
    "use strict";
    var BAD = 16209;
    var TYPE = 16191;
    module.exports = function inflate_fast(strm, start) {
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
      const state2 = strm.state;
      _in = strm.next_in;
      input = strm.input;
      last = _in + (strm.avail_in - 5);
      _out = strm.next_out;
      output = strm.output;
      beg = _out - (start - strm.avail_out);
      end = _out + (strm.avail_out - 257);
      dmax = state2.dmax;
      wsize = state2.wsize;
      whave = state2.whave;
      wnext = state2.wnext;
      s_window = state2.window;
      hold = state2.hold;
      bits2 = state2.bits;
      lcode = state2.lencode;
      dcode = state2.distcode;
      lmask = (1 << state2.lenbits) - 1;
      dmask = (1 << state2.distbits) - 1;
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
                        state2.mode = BAD;
                        break top;
                      }
                      hold >>>= op;
                      bits2 -= op;
                      op = _out - beg;
                      if (dist > op) {
                        op = dist - op;
                        if (op > whave) {
                          if (state2.sane) {
                            strm.msg = "invalid distance too far back";
                            state2.mode = BAD;
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
                      state2.mode = BAD;
                      break top;
                    }
                    break;
                  }
              } else if ((op & 64) === 0) {
                here = lcode[(here & 65535) + (hold & (1 << op) - 1)];
                continue dolen;
              } else if (op & 32) {
                state2.mode = TYPE;
                break top;
              } else {
                strm.msg = "invalid literal/length code";
                state2.mode = BAD;
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
      state2.hold = hold;
      state2.bits = bits2;
      return;
    };
  }
});

// ../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/inftrees.js
var require_inftrees = __commonJS({
  "../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/inftrees.js"(exports, module) {
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
      let min = 0, max3 = 0;
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
      for (max3 = MAXBITS; max3 >= 1; max3--) {
        if (count[max3] !== 0) {
          break;
        }
      }
      if (root > max3) {
        root = max3;
      }
      if (max3 === 0) {
        table[table_index++] = 1 << 24 | 64 << 16 | 0;
        table[table_index++] = 1 << 24 | 64 << 16 | 0;
        opts.bits = 1;
        return 0;
      }
      for (min = 1; min < max3; min++) {
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
      if (left > 0 && (type === CODES || max3 !== 1)) {
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
          if (len === max3) {
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
          while (curr + drop < max3) {
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
    module.exports = inflate_table;
  }
});

// ../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/constants.js
var require_constants = __commonJS({
  "../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/constants.js"(exports, module) {
    "use strict";
    module.exports = {
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
  "../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/inflate.js"(exports, module) {
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
      const state2 = strm.state;
      if (!state2 || state2.strm !== strm || state2.mode < HEAD || state2.mode > SYNC) {
        return 1;
      }
      return 0;
    };
    var inflateResetKeep = (strm) => {
      if (inflateStateCheck(strm)) {
        return Z_STREAM_ERROR;
      }
      const state2 = strm.state;
      strm.total_in = strm.total_out = state2.total = 0;
      strm.msg = "";
      if (state2.wrap) {
        strm.adler = state2.wrap & 1;
      }
      state2.mode = HEAD;
      state2.last = 0;
      state2.havedict = 0;
      state2.flags = -1;
      state2.dmax = 32768;
      state2.head = null;
      state2.hold = 0;
      state2.bits = 0;
      state2.lencode = state2.lendyn = new Int32Array(ENOUGH_LENS);
      state2.distcode = state2.distdyn = new Int32Array(ENOUGH_DISTS);
      state2.sane = 1;
      state2.back = -1;
      return Z_OK;
    };
    var inflateReset = (strm) => {
      if (inflateStateCheck(strm)) {
        return Z_STREAM_ERROR;
      }
      const state2 = strm.state;
      state2.wsize = 0;
      state2.whave = 0;
      state2.wnext = 0;
      return inflateResetKeep(strm);
    };
    var inflateReset2 = (strm, windowBits) => {
      let wrap;
      if (inflateStateCheck(strm)) {
        return Z_STREAM_ERROR;
      }
      const state2 = strm.state;
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
      if (state2.window !== null && state2.wbits !== windowBits) {
        state2.window = null;
      }
      state2.wrap = wrap;
      state2.wbits = windowBits;
      return inflateReset(strm);
    };
    var inflateInit2 = (strm, windowBits) => {
      if (!strm) {
        return Z_STREAM_ERROR;
      }
      const state2 = new InflateState();
      strm.state = state2;
      state2.strm = strm;
      state2.window = null;
      state2.mode = HEAD;
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
    var fixedtables = (state2) => {
      if (virgin) {
        lenfix = new Int32Array(512);
        distfix = new Int32Array(32);
        let sym = 0;
        while (sym < 144) {
          state2.lens[sym++] = 8;
        }
        while (sym < 256) {
          state2.lens[sym++] = 9;
        }
        while (sym < 280) {
          state2.lens[sym++] = 7;
        }
        while (sym < 288) {
          state2.lens[sym++] = 8;
        }
        inflate_table(LENS, state2.lens, 0, 288, lenfix, 0, state2.work, { bits: 9 });
        sym = 0;
        while (sym < 32) {
          state2.lens[sym++] = 5;
        }
        inflate_table(DISTS, state2.lens, 0, 32, distfix, 0, state2.work, { bits: 5 });
        virgin = false;
      }
      state2.lencode = lenfix;
      state2.lenbits = 9;
      state2.distcode = distfix;
      state2.distbits = 5;
    };
    var updatewindow = (strm, src, end, copy) => {
      let dist;
      const state2 = strm.state;
      if (state2.window === null) {
        state2.wsize = 1 << state2.wbits;
        state2.wnext = 0;
        state2.whave = 0;
        state2.window = new Uint8Array(state2.wsize);
      }
      if (copy >= state2.wsize) {
        state2.window.set(src.subarray(end - state2.wsize, end), 0);
        state2.wnext = 0;
        state2.whave = state2.wsize;
      } else {
        dist = state2.wsize - state2.wnext;
        if (dist > copy) {
          dist = copy;
        }
        state2.window.set(src.subarray(end - copy, end - copy + dist), state2.wnext);
        copy -= dist;
        if (copy) {
          state2.window.set(src.subarray(end - copy, end), 0);
          state2.wnext = copy;
          state2.whave = state2.wsize;
        } else {
          state2.wnext += dist;
          if (state2.wnext === state2.wsize) {
            state2.wnext = 0;
          }
          if (state2.whave < state2.wsize) {
            state2.whave += dist;
          }
        }
      }
      return 0;
    };
    var inflate = (strm, flush) => {
      let state2;
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
      state2 = strm.state;
      if (state2.mode === TYPE) {
        state2.mode = TYPEDO;
      }
      put = strm.next_out;
      output = strm.output;
      left = strm.avail_out;
      next = strm.next_in;
      input = strm.input;
      have = strm.avail_in;
      hold = state2.hold;
      bits2 = state2.bits;
      _in = have;
      _out = left;
      ret = Z_OK;
      inf_leave:
        for (; ; ) {
          switch (state2.mode) {
            case HEAD:
              if (state2.wrap === 0) {
                state2.mode = TYPEDO;
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
              if (state2.wrap & 2 && hold === 35615) {
                if (state2.wbits === 0) {
                  state2.wbits = 15;
                }
                state2.check = 0;
                hbuf[0] = hold & 255;
                hbuf[1] = hold >>> 8 & 255;
                state2.check = crc32(state2.check, hbuf, 2, 0);
                hold = 0;
                bits2 = 0;
                state2.mode = FLAGS;
                break;
              }
              if (state2.head) {
                state2.head.done = false;
              }
              if (!(state2.wrap & 1) || /* check if zlib header allowed */
              (((hold & 255) << 8) + (hold >> 8)) % 31) {
                strm.msg = "incorrect header check";
                state2.mode = BAD;
                break;
              }
              if ((hold & 15) !== Z_DEFLATED) {
                strm.msg = "unknown compression method";
                state2.mode = BAD;
                break;
              }
              hold >>>= 4;
              bits2 -= 4;
              len = (hold & 15) + 8;
              if (state2.wbits === 0) {
                state2.wbits = len;
              }
              if (len > 15 || len > state2.wbits) {
                strm.msg = "invalid window size";
                state2.mode = BAD;
                break;
              }
              state2.dmax = 1 << state2.wbits;
              state2.flags = 0;
              strm.adler = state2.check = 1;
              state2.mode = hold & 512 ? DICTID : TYPE;
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
              state2.flags = hold;
              if ((state2.flags & 255) !== Z_DEFLATED) {
                strm.msg = "unknown compression method";
                state2.mode = BAD;
                break;
              }
              if (state2.flags & 57344) {
                strm.msg = "unknown header flags set";
                state2.mode = BAD;
                break;
              }
              if (state2.head) {
                state2.head.text = hold >> 8 & 1;
              }
              if (state2.flags & 512 && state2.wrap & 4) {
                hbuf[0] = hold & 255;
                hbuf[1] = hold >>> 8 & 255;
                state2.check = crc32(state2.check, hbuf, 2, 0);
              }
              hold = 0;
              bits2 = 0;
              state2.mode = TIME;
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
              if (state2.head) {
                state2.head.time = hold;
              }
              if (state2.flags & 512 && state2.wrap & 4) {
                hbuf[0] = hold & 255;
                hbuf[1] = hold >>> 8 & 255;
                hbuf[2] = hold >>> 16 & 255;
                hbuf[3] = hold >>> 24 & 255;
                state2.check = crc32(state2.check, hbuf, 4, 0);
              }
              hold = 0;
              bits2 = 0;
              state2.mode = OS;
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
              if (state2.head) {
                state2.head.xflags = hold & 255;
                state2.head.os = hold >> 8;
              }
              if (state2.flags & 512 && state2.wrap & 4) {
                hbuf[0] = hold & 255;
                hbuf[1] = hold >>> 8 & 255;
                state2.check = crc32(state2.check, hbuf, 2, 0);
              }
              hold = 0;
              bits2 = 0;
              state2.mode = EXLEN;
            /* falls through */
            case EXLEN:
              if (state2.flags & 1024) {
                while (bits2 < 16) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits2;
                  bits2 += 8;
                }
                state2.length = hold;
                if (state2.head) {
                  state2.head.extra_len = hold;
                }
                if (state2.flags & 512 && state2.wrap & 4) {
                  hbuf[0] = hold & 255;
                  hbuf[1] = hold >>> 8 & 255;
                  state2.check = crc32(state2.check, hbuf, 2, 0);
                }
                hold = 0;
                bits2 = 0;
              } else if (state2.head) {
                state2.head.extra = null;
              }
              state2.mode = EXTRA;
            /* falls through */
            case EXTRA:
              if (state2.flags & 1024) {
                copy = state2.length;
                if (copy > have) {
                  copy = have;
                }
                if (copy) {
                  if (state2.head) {
                    len = state2.head.extra_len - state2.length;
                    if (!state2.head.extra) {
                      state2.head.extra = new Uint8Array(state2.head.extra_len);
                    }
                    state2.head.extra.set(
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
                  if (state2.flags & 512 && state2.wrap & 4) {
                    state2.check = crc32(state2.check, input, copy, next);
                  }
                  have -= copy;
                  next += copy;
                  state2.length -= copy;
                }
                if (state2.length) {
                  break inf_leave;
                }
              }
              state2.length = 0;
              state2.mode = NAME;
            /* falls through */
            case NAME:
              if (state2.flags & 2048) {
                if (have === 0) {
                  break inf_leave;
                }
                copy = 0;
                do {
                  len = input[next + copy++];
                  if (state2.head && len && state2.length < 65536) {
                    state2.head.name += String.fromCharCode(len);
                  }
                } while (len && copy < have);
                if (state2.flags & 512 && state2.wrap & 4) {
                  state2.check = crc32(state2.check, input, copy, next);
                }
                have -= copy;
                next += copy;
                if (len) {
                  break inf_leave;
                }
              } else if (state2.head) {
                state2.head.name = null;
              }
              state2.length = 0;
              state2.mode = COMMENT;
            /* falls through */
            case COMMENT:
              if (state2.flags & 4096) {
                if (have === 0) {
                  break inf_leave;
                }
                copy = 0;
                do {
                  len = input[next + copy++];
                  if (state2.head && len && state2.length < 65536) {
                    state2.head.comment += String.fromCharCode(len);
                  }
                } while (len && copy < have);
                if (state2.flags & 512 && state2.wrap & 4) {
                  state2.check = crc32(state2.check, input, copy, next);
                }
                have -= copy;
                next += copy;
                if (len) {
                  break inf_leave;
                }
              } else if (state2.head) {
                state2.head.comment = null;
              }
              state2.mode = HCRC;
            /* falls through */
            case HCRC:
              if (state2.flags & 512) {
                while (bits2 < 16) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits2;
                  bits2 += 8;
                }
                if (state2.wrap & 4 && hold !== (state2.check & 65535)) {
                  strm.msg = "header crc mismatch";
                  state2.mode = BAD;
                  break;
                }
                hold = 0;
                bits2 = 0;
              }
              if (state2.head) {
                state2.head.hcrc = state2.flags >> 9 & 1;
                state2.head.done = true;
              }
              strm.adler = state2.check = 0;
              state2.mode = TYPE;
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
              strm.adler = state2.check = zswap32(hold);
              hold = 0;
              bits2 = 0;
              state2.mode = DICT;
            /* falls through */
            case DICT:
              if (state2.havedict === 0) {
                strm.next_out = put;
                strm.avail_out = left;
                strm.next_in = next;
                strm.avail_in = have;
                state2.hold = hold;
                state2.bits = bits2;
                return Z_NEED_DICT;
              }
              strm.adler = state2.check = 1;
              state2.mode = TYPE;
            /* falls through */
            case TYPE:
              if (flush === Z_BLOCK || flush === Z_TREES) {
                break inf_leave;
              }
            /* falls through */
            case TYPEDO:
              if (state2.last) {
                hold >>>= bits2 & 7;
                bits2 -= bits2 & 7;
                state2.mode = CHECK;
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
              state2.last = hold & 1;
              hold >>>= 1;
              bits2 -= 1;
              switch (hold & 3) {
                case 0:
                  state2.mode = STORED;
                  break;
                case 1:
                  fixedtables(state2);
                  state2.mode = LEN_;
                  if (flush === Z_TREES) {
                    hold >>>= 2;
                    bits2 -= 2;
                    break inf_leave;
                  }
                  break;
                case 2:
                  state2.mode = TABLE;
                  break;
                case 3:
                  strm.msg = "invalid block type";
                  state2.mode = BAD;
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
                state2.mode = BAD;
                break;
              }
              state2.length = hold & 65535;
              hold = 0;
              bits2 = 0;
              state2.mode = COPY_;
              if (flush === Z_TREES) {
                break inf_leave;
              }
            /* falls through */
            case COPY_:
              state2.mode = COPY;
            /* falls through */
            case COPY:
              copy = state2.length;
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
                state2.length -= copy;
                break;
              }
              state2.mode = TYPE;
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
              state2.nlen = (hold & 31) + 257;
              hold >>>= 5;
              bits2 -= 5;
              state2.ndist = (hold & 31) + 1;
              hold >>>= 5;
              bits2 -= 5;
              state2.ncode = (hold & 15) + 4;
              hold >>>= 4;
              bits2 -= 4;
              if (state2.nlen > 286 || state2.ndist > 30) {
                strm.msg = "too many length or distance symbols";
                state2.mode = BAD;
                break;
              }
              state2.have = 0;
              state2.mode = LENLENS;
            /* falls through */
            case LENLENS:
              while (state2.have < state2.ncode) {
                while (bits2 < 3) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits2;
                  bits2 += 8;
                }
                state2.lens[order[state2.have++]] = hold & 7;
                hold >>>= 3;
                bits2 -= 3;
              }
              while (state2.have < 19) {
                state2.lens[order[state2.have++]] = 0;
              }
              state2.lencode = state2.lendyn;
              state2.lenbits = 7;
              opts = { bits: state2.lenbits };
              ret = inflate_table(CODES, state2.lens, 0, 19, state2.lencode, 0, state2.work, opts);
              state2.lenbits = opts.bits;
              if (ret) {
                strm.msg = "invalid code lengths set";
                state2.mode = BAD;
                break;
              }
              state2.have = 0;
              state2.mode = CODELENS;
            /* falls through */
            case CODELENS:
              while (state2.have < state2.nlen + state2.ndist) {
                for (; ; ) {
                  here = state2.lencode[hold & (1 << state2.lenbits) - 1];
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
                  state2.lens[state2.have++] = here_val;
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
                    if (state2.have === 0) {
                      strm.msg = "invalid bit length repeat";
                      state2.mode = BAD;
                      break;
                    }
                    len = state2.lens[state2.have - 1];
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
                  if (state2.have + copy > state2.nlen + state2.ndist) {
                    strm.msg = "invalid bit length repeat";
                    state2.mode = BAD;
                    break;
                  }
                  while (copy--) {
                    state2.lens[state2.have++] = len;
                  }
                }
              }
              if (state2.mode === BAD) {
                break;
              }
              if (state2.lens[256] === 0) {
                strm.msg = "invalid code -- missing end-of-block";
                state2.mode = BAD;
                break;
              }
              state2.lenbits = 9;
              opts = { bits: state2.lenbits };
              ret = inflate_table(LENS, state2.lens, 0, state2.nlen, state2.lencode, 0, state2.work, opts);
              state2.lenbits = opts.bits;
              if (ret) {
                strm.msg = "invalid literal/lengths set";
                state2.mode = BAD;
                break;
              }
              state2.distbits = 6;
              state2.distcode = state2.distdyn;
              opts = { bits: state2.distbits };
              ret = inflate_table(DISTS, state2.lens, state2.nlen, state2.ndist, state2.distcode, 0, state2.work, opts);
              state2.distbits = opts.bits;
              if (ret) {
                strm.msg = "invalid distances set";
                state2.mode = BAD;
                break;
              }
              state2.mode = LEN_;
              if (flush === Z_TREES) {
                break inf_leave;
              }
            /* falls through */
            case LEN_:
              state2.mode = LEN;
            /* falls through */
            case LEN:
              if (have >= 6 && left >= 258) {
                strm.next_out = put;
                strm.avail_out = left;
                strm.next_in = next;
                strm.avail_in = have;
                state2.hold = hold;
                state2.bits = bits2;
                inflate_fast(strm, _out);
                put = strm.next_out;
                output = strm.output;
                left = strm.avail_out;
                next = strm.next_in;
                input = strm.input;
                have = strm.avail_in;
                hold = state2.hold;
                bits2 = state2.bits;
                if (state2.mode === TYPE) {
                  state2.back = -1;
                }
                break;
              }
              state2.back = 0;
              for (; ; ) {
                here = state2.lencode[hold & (1 << state2.lenbits) - 1];
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
                  here = state2.lencode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
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
                state2.back += last_bits;
              }
              hold >>>= here_bits;
              bits2 -= here_bits;
              state2.back += here_bits;
              state2.length = here_val;
              if (here_op === 0) {
                state2.mode = LIT;
                break;
              }
              if (here_op & 32) {
                state2.back = -1;
                state2.mode = TYPE;
                break;
              }
              if (here_op & 64) {
                strm.msg = "invalid literal/length code";
                state2.mode = BAD;
                break;
              }
              state2.extra = here_op & 15;
              state2.mode = LENEXT;
            /* falls through */
            case LENEXT:
              if (state2.extra) {
                n = state2.extra;
                while (bits2 < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits2;
                  bits2 += 8;
                }
                state2.length += hold & (1 << state2.extra) - 1;
                hold >>>= state2.extra;
                bits2 -= state2.extra;
                state2.back += state2.extra;
              }
              state2.was = state2.length;
              state2.mode = DIST;
            /* falls through */
            case DIST:
              for (; ; ) {
                here = state2.distcode[hold & (1 << state2.distbits) - 1];
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
                  here = state2.distcode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
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
                state2.back += last_bits;
              }
              hold >>>= here_bits;
              bits2 -= here_bits;
              state2.back += here_bits;
              if (here_op & 64) {
                strm.msg = "invalid distance code";
                state2.mode = BAD;
                break;
              }
              state2.offset = here_val;
              state2.extra = here_op & 15;
              state2.mode = DISTEXT;
            /* falls through */
            case DISTEXT:
              if (state2.extra) {
                n = state2.extra;
                while (bits2 < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits2;
                  bits2 += 8;
                }
                state2.offset += hold & (1 << state2.extra) - 1;
                hold >>>= state2.extra;
                bits2 -= state2.extra;
                state2.back += state2.extra;
              }
              if (state2.offset > state2.dmax) {
                strm.msg = "invalid distance too far back";
                state2.mode = BAD;
                break;
              }
              state2.mode = MATCH;
            /* falls through */
            case MATCH:
              if (left === 0) {
                break inf_leave;
              }
              copy = _out - left;
              if (state2.offset > copy) {
                copy = state2.offset - copy;
                if (copy > state2.whave) {
                  if (state2.sane) {
                    strm.msg = "invalid distance too far back";
                    state2.mode = BAD;
                    break;
                  }
                }
                if (copy > state2.wnext) {
                  copy -= state2.wnext;
                  from = state2.wsize - copy;
                } else {
                  from = state2.wnext - copy;
                }
                if (copy > state2.length) {
                  copy = state2.length;
                }
                from_source = state2.window;
              } else {
                from_source = output;
                from = put - state2.offset;
                copy = state2.length;
              }
              if (copy > left) {
                copy = left;
              }
              left -= copy;
              state2.length -= copy;
              do {
                output[put++] = from_source[from++];
              } while (--copy);
              if (state2.length === 0) {
                state2.mode = LEN;
              }
              break;
            case LIT:
              if (left === 0) {
                break inf_leave;
              }
              output[put++] = state2.length;
              left--;
              state2.mode = LEN;
              break;
            case CHECK:
              if (state2.wrap) {
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
                state2.total += _out;
                if (state2.wrap & 4 && _out) {
                  strm.adler = state2.check = /*UPDATE_CHECK(state.check, put - _out, _out);*/
                  state2.flags ? crc32(state2.check, output, _out, put - _out) : adler32(state2.check, output, _out, put - _out);
                }
                _out = left;
                if (state2.wrap & 4 && (state2.flags ? hold : zswap32(hold)) !== state2.check) {
                  strm.msg = "incorrect data check";
                  state2.mode = BAD;
                  break;
                }
                hold = 0;
                bits2 = 0;
              }
              state2.mode = LENGTH;
            /* falls through */
            case LENGTH:
              if (state2.wrap && state2.flags) {
                while (bits2 < 32) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits2;
                  bits2 += 8;
                }
                if (state2.wrap & 4 && hold !== (state2.total & 4294967295)) {
                  strm.msg = "incorrect length check";
                  state2.mode = BAD;
                  break;
                }
                hold = 0;
                bits2 = 0;
              }
              state2.mode = DONE;
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
      state2.hold = hold;
      state2.bits = bits2;
      if (state2.wsize || _out !== strm.avail_out && state2.mode < BAD && (state2.mode < CHECK || flush !== Z_FINISH)) {
        if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) {
          state2.mode = MEM;
          return Z_MEM_ERROR;
        }
      }
      _in -= strm.avail_in;
      _out -= strm.avail_out;
      strm.total_in += _in;
      strm.total_out += _out;
      state2.total += _out;
      if (state2.wrap & 4 && _out) {
        strm.adler = state2.check = /*UPDATE_CHECK(state.check, strm.next_out - _out, _out);*/
        state2.flags ? crc32(state2.check, output, _out, strm.next_out - _out) : adler32(state2.check, output, _out, strm.next_out - _out);
      }
      strm.data_type = state2.bits + (state2.last ? 64 : 0) + (state2.mode === TYPE ? 128 : 0) + (state2.mode === LEN_ || state2.mode === COPY_ ? 256 : 0);
      if ((_in === 0 && _out === 0 || flush === Z_FINISH) && ret === Z_OK) {
        ret = Z_BUF_ERROR;
      }
      return ret;
    };
    var inflateEnd = (strm) => {
      if (inflateStateCheck(strm)) {
        return Z_STREAM_ERROR;
      }
      let state2 = strm.state;
      if (state2.window) {
        state2.window = null;
      }
      strm.state = null;
      return Z_OK;
    };
    var inflateGetHeader = (strm, head) => {
      if (inflateStateCheck(strm)) {
        return Z_STREAM_ERROR;
      }
      const state2 = strm.state;
      if ((state2.wrap & 2) === 0) {
        return Z_STREAM_ERROR;
      }
      state2.head = head;
      head.done = false;
      return Z_OK;
    };
    var inflateSetDictionary = (strm, dictionary) => {
      const dictLength = dictionary.length;
      let state2;
      let dictid;
      let ret;
      if (inflateStateCheck(strm)) {
        return Z_STREAM_ERROR;
      }
      state2 = strm.state;
      if (state2.wrap !== 0 && state2.mode !== DICT) {
        return Z_STREAM_ERROR;
      }
      if (state2.mode === DICT) {
        dictid = 1;
        dictid = adler32(dictid, dictionary, dictLength, 0);
        if (dictid !== state2.check) {
          return Z_DATA_ERROR;
        }
      }
      ret = updatewindow(strm, dictionary, dictLength, dictLength);
      if (ret) {
        state2.mode = MEM;
        return Z_MEM_ERROR;
      }
      state2.havedict = 1;
      return Z_OK;
    };
    module.exports.inflateReset = inflateReset;
    module.exports.inflateReset2 = inflateReset2;
    module.exports.inflateResetKeep = inflateResetKeep;
    module.exports.inflateInit = inflateInit;
    module.exports.inflateInit2 = inflateInit2;
    module.exports.inflate = inflate;
    module.exports.inflateEnd = inflateEnd;
    module.exports.inflateGetHeader = inflateGetHeader;
    module.exports.inflateSetDictionary = inflateSetDictionary;
    module.exports.inflateInfo = "pako inflate (from Nodeca project)";
  }
});

// ../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/zstream.js
var require_zstream = __commonJS({
  "../image-codecs/node_modules/.pnpm/pako@2.1.0/node_modules/pako/lib/zlib/zstream.js"(exports, module) {
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
    module.exports = ZStream2;
  }
});

// ../image-codecs/node_modules/.pnpm/jpeg-js@0.4.4_patch_hash=9f_7b177a39bcbb567e1a40d7d8ec08ec1e/node_modules/jpeg-js/lib/decoder.js
var require_decoder = __commonJS({
  "../image-codecs/node_modules/.pnpm/jpeg-js@0.4.4_patch_hash=9f_7b177a39bcbb567e1a40d7d8ec08ec1e/node_modules/jpeg-js/lib/decoder.js"(exports, module) {
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
      function decodeScan(data, offset, frame2, components, resetInterval, spectralStart, spectralEnd, successivePrev, successive, opts) {
        var precision = frame2.precision;
        var samplesPerLine = frame2.samplesPerLine;
        var scanLines = frame2.scanLines;
        var mcusPerLine = frame2.mcusPerLine;
        var progressive = frame2.progressive;
        var maxH = frame2.maxH, maxV = frame2.maxV;
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
          mcuExpected = mcusPerLine * frame2.mcusPerColumn;
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
      function buildComponentData(frame2, component) {
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
          function prepareComponents(frame3) {
            var maxH2 = 1, maxV2 = 1;
            var component2, componentId2;
            for (componentId2 in frame3.components) {
              if (frame3.components.hasOwnProperty(componentId2)) {
                component2 = frame3.components[componentId2];
                if (maxH2 < component2.h) maxH2 = component2.h;
                if (maxV2 < component2.v) maxV2 = component2.v;
              }
            }
            var mcusPerLine = Math.ceil(frame3.samplesPerLine / 8 / maxH2);
            var mcusPerColumn = Math.ceil(frame3.scanLines / 8 / maxV2);
            for (componentId2 in frame3.components) {
              if (frame3.components.hasOwnProperty(componentId2)) {
                component2 = frame3.components[componentId2];
                var blocksPerLine = Math.ceil(Math.ceil(frame3.samplesPerLine / 8) * component2.h / maxH2);
                var blocksPerColumn = Math.ceil(Math.ceil(frame3.scanLines / 8) * component2.v / maxV2);
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
            frame3.maxH = maxH2;
            frame3.maxV = maxV2;
            frame3.mcusPerLine = mcusPerLine;
            frame3.mcusPerColumn = mcusPerColumn;
          }
          var jfif = null;
          var adobe = null;
          var pixels = null;
          var frame2, resetInterval;
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
                frame2 = {};
                frame2.extended = fileMarker === 65473;
                frame2.progressive = fileMarker === 65474;
                frame2.precision = data[offset++];
                frame2.scanLines = readUint16();
                frame2.samplesPerLine = readUint16();
                frame2.components = {};
                frame2.componentsOrder = [];
                var pixelsInFrame = frame2.scanLines * frame2.samplesPerLine;
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
                  frame2.componentsOrder.push(componentId);
                  frame2.components[componentId] = {
                    h,
                    v,
                    quantizationIdx: qId
                  };
                  offset += 3;
                }
                prepareComponents(frame2);
                frames.push(frame2);
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
                  component = frame2.components[data[offset++]];
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
                  frame2,
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
          this.width = frame2.samplesPerLine;
          this.height = frame2.scanLines;
          this.jfif = jfif;
          this.adobe = adobe;
          this.components = [];
          for (var i2 = 0; i2 < frame2.componentsOrder.length; i2++) {
            var component = frame2.components[frame2.componentsOrder[i2]];
            this.components.push({
              lines: buildComponentData(frame2, component),
              scaleX: component.h / frame2.maxH,
              scaleY: component.v / frame2.maxV
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
    if (typeof module !== "undefined") {
      module.exports = decode4;
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

// ../image-codecs/node_modules/.pnpm/fflate@0.8.2/node_modules/fflate/esm/browser.js
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
var flm = /* @__PURE__ */ hMap(flt, 9, 0);
var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
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
var wbits = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
};
var wbits16 = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
  d[o + 2] |= v >> 16;
};
var hTree = function(d, mb) {
  var t = [];
  for (var i2 = 0; i2 < d.length; ++i2) {
    if (d[i2])
      t.push({ s: i2, f: d[i2] });
  }
  var s = t.length;
  var t2 = t.slice();
  if (!s)
    return { t: et, l: 0 };
  if (s == 1) {
    var v = new u8(t[0].s + 1);
    v[t[0].s] = 1;
    return { t: v, l: 1 };
  }
  t.sort(function(a, b) {
    return a.f - b.f;
  });
  t.push({ s: -1, f: 25001 });
  var l = t[0], r = t[1], i0 = 0, i1 = 1, i22 = 2;
  t[0] = { s: -1, f: l.f + r.f, l, r };
  while (i1 != s - 1) {
    l = t[t[i0].f < t[i22].f ? i0++ : i22++];
    r = t[i0 != i1 && t[i0].f < t[i22].f ? i0++ : i22++];
    t[i1++] = { s: -1, f: l.f + r.f, l, r };
  }
  var maxSym = t2[0].s;
  for (var i2 = 1; i2 < s; ++i2) {
    if (t2[i2].s > maxSym)
      maxSym = t2[i2].s;
  }
  var tr = new u16(maxSym + 1);
  var mbt = ln(t[i1 - 1], tr, 0);
  if (mbt > mb) {
    var i2 = 0, dt = 0;
    var lft = mbt - mb, cst = 1 << lft;
    t2.sort(function(a, b) {
      return tr[b.s] - tr[a.s] || a.f - b.f;
    });
    for (; i2 < s; ++i2) {
      var i2_1 = t2[i2].s;
      if (tr[i2_1] > mb) {
        dt += cst - (1 << mbt - tr[i2_1]);
        tr[i2_1] = mb;
      } else
        break;
    }
    dt >>= lft;
    while (dt > 0) {
      var i2_2 = t2[i2].s;
      if (tr[i2_2] < mb)
        dt -= 1 << mb - tr[i2_2]++ - 1;
      else
        ++i2;
    }
    for (; i2 >= 0 && dt; --i2) {
      var i2_3 = t2[i2].s;
      if (tr[i2_3] == mb) {
        --tr[i2_3];
        ++dt;
      }
    }
    mbt = mb;
  }
  return { t: new u8(tr), l: mbt };
};
var ln = function(n, l, d) {
  return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
};
var lc = function(c) {
  var s = c.length;
  while (s && !c[--s])
    ;
  var cl = new u16(++s);
  var cli = 0, cln = c[0], cls = 1;
  var w = function(v) {
    cl[cli++] = v;
  };
  for (var i2 = 1; i2 <= s; ++i2) {
    if (c[i2] == cln && i2 != s)
      ++cls;
    else {
      if (!cln && cls > 2) {
        for (; cls > 138; cls -= 138)
          w(32754);
        if (cls > 2) {
          w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
          cls = 0;
        }
      } else if (cls > 3) {
        w(cln), --cls;
        for (; cls > 6; cls -= 6)
          w(8304);
        if (cls > 2)
          w(cls - 3 << 5 | 8208), cls = 0;
      }
      while (cls--)
        w(cln);
      cls = 1;
      cln = c[i2];
    }
  }
  return { c: cl.subarray(0, cli), n: s };
};
var clen = function(cf, cl) {
  var l = 0;
  for (var i2 = 0; i2 < cl.length; ++i2)
    l += cf[i2] * cl[i2];
  return l;
};
var wfblk = function(out, pos, dat) {
  var s = dat.length;
  var o = shft(pos + 2);
  out[o] = s & 255;
  out[o + 1] = s >> 8;
  out[o + 2] = out[o] ^ 255;
  out[o + 3] = out[o + 1] ^ 255;
  for (var i2 = 0; i2 < s; ++i2)
    out[o + i2 + 4] = dat[i2];
  return (o + 4 + s) * 8;
};
var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
  wbits(out, p++, final);
  ++lf[256];
  var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
  var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
  var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
  var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
  var lcfreq = new u16(19);
  for (var i2 = 0; i2 < lclt.length; ++i2)
    ++lcfreq[lclt[i2] & 31];
  for (var i2 = 0; i2 < lcdt.length; ++i2)
    ++lcfreq[lcdt[i2] & 31];
  var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
  var nlcc = 19;
  for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
    ;
  var flen = bl + 5 << 3;
  var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
  var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
  if (bs >= 0 && flen <= ftlen && flen <= dtlen)
    return wfblk(out, p, dat.subarray(bs, bs + bl));
  var lm, ll, dm, dl;
  wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
  if (dtlen < ftlen) {
    lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
    var llm = hMap(lct, mlcb, 0);
    wbits(out, p, nlc - 257);
    wbits(out, p + 5, ndc - 1);
    wbits(out, p + 10, nlcc - 4);
    p += 14;
    for (var i2 = 0; i2 < nlcc; ++i2)
      wbits(out, p + 3 * i2, lct[clim[i2]]);
    p += 3 * nlcc;
    var lcts = [lclt, lcdt];
    for (var it = 0; it < 2; ++it) {
      var clct = lcts[it];
      for (var i2 = 0; i2 < clct.length; ++i2) {
        var len = clct[i2] & 31;
        wbits(out, p, llm[len]), p += lct[len];
        if (len > 15)
          wbits(out, p, clct[i2] >> 5 & 127), p += clct[i2] >> 12;
      }
    }
  } else {
    lm = flm, ll = flt, dm = fdm, dl = fdt;
  }
  for (var i2 = 0; i2 < li; ++i2) {
    var sym = syms[i2];
    if (sym > 255) {
      var len = sym >> 18 & 31;
      wbits16(out, p, lm[len + 257]), p += ll[len + 257];
      if (len > 7)
        wbits(out, p, sym >> 23 & 31), p += fleb[len];
      var dst = sym & 31;
      wbits16(out, p, dm[dst]), p += dl[dst];
      if (dst > 3)
        wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
    } else {
      wbits16(out, p, lm[sym]), p += ll[sym];
    }
  }
  wbits16(out, p, lm[256]);
  return p + ll[256];
};
var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
var et = /* @__PURE__ */ new u8(0);
var dflt = function(dat, lvl, plvl, pre, post2, st) {
  var s = st.z || dat.length;
  var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post2);
  var w = o.subarray(pre, o.length - post2);
  var lst = st.l;
  var pos = (st.r || 0) & 7;
  if (lvl) {
    if (pos)
      w[0] = st.r >> 3;
    var opt = deo[lvl - 1];
    var n = opt >> 13, c = opt & 8191;
    var msk_1 = (1 << plvl) - 1;
    var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
    var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
    var hsh = function(i3) {
      return (dat[i3] ^ dat[i3 + 1] << bs1_1 ^ dat[i3 + 2] << bs2_1) & msk_1;
    };
    var syms = new i32(25e3);
    var lf = new u16(288), df = new u16(32);
    var lc_1 = 0, eb = 0, i2 = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
    for (; i2 + 2 < s; ++i2) {
      var hv = hsh(i2);
      var imod = i2 & 32767, pimod = head[hv];
      prev[imod] = pimod;
      head[hv] = imod;
      if (wi <= i2) {
        var rem = s - i2;
        if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
          pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i2 - bs, pos);
          li = lc_1 = eb = 0, bs = i2;
          for (var j = 0; j < 286; ++j)
            lf[j] = 0;
          for (var j = 0; j < 30; ++j)
            df[j] = 0;
        }
        var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
        if (rem > 2 && hv == hsh(i2 - dif)) {
          var maxn = Math.min(n, rem) - 1;
          var maxd = Math.min(32767, i2);
          var ml = Math.min(258, rem);
          while (dif <= maxd && --ch_1 && imod != pimod) {
            if (dat[i2 + l] == dat[i2 + l - dif]) {
              var nl = 0;
              for (; nl < ml && dat[i2 + nl] == dat[i2 + nl - dif]; ++nl)
                ;
              if (nl > l) {
                l = nl, d = dif;
                if (nl > maxn)
                  break;
                var mmd = Math.min(dif, nl - 2);
                var md = 0;
                for (var j = 0; j < mmd; ++j) {
                  var ti = i2 - dif + j & 32767;
                  var pti = prev[ti];
                  var cd = ti - pti & 32767;
                  if (cd > md)
                    md = cd, pimod = ti;
                }
              }
            }
            imod = pimod, pimod = prev[imod];
            dif += imod - pimod & 32767;
          }
        }
        if (d) {
          syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
          var lin = revfl[l] & 31, din = revfd[d] & 31;
          eb += fleb[lin] + fdeb[din];
          ++lf[257 + lin];
          ++df[din];
          wi = i2 + l;
          ++lc_1;
        } else {
          syms[li++] = dat[i2];
          ++lf[dat[i2]];
        }
      }
    }
    for (i2 = Math.max(i2, wi); i2 < s; ++i2) {
      syms[li++] = dat[i2];
      ++lf[dat[i2]];
    }
    pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i2 - bs, pos);
    if (!lst) {
      st.r = pos & 7 | w[pos / 8 | 0] << 3;
      pos -= 7;
      st.h = head, st.p = prev, st.i = i2, st.w = wi;
    }
  } else {
    for (var i2 = st.w || 0; i2 < s + lst; i2 += 65535) {
      var e = i2 + 65535;
      if (e >= s) {
        w[pos / 8 | 0] = lst;
        e = s;
      }
      pos = wfblk(w, pos + 1, dat.subarray(i2, e));
    }
    st.i = s;
  }
  return slc(o, 0, pre + shft(pos) + post2);
};
var adler = function() {
  var a = 1, b = 0;
  return {
    p: function(d) {
      var n = a, m = b;
      var l = d.length | 0;
      for (var i2 = 0; i2 != l; ) {
        var e = Math.min(i2 + 2655, l);
        for (; i2 < e; ++i2)
          m += n += d[i2];
        n = (n & 65535) + 15 * (n >> 16), m = (m & 65535) + 15 * (m >> 16);
      }
      a = n, b = m;
    },
    d: function() {
      a %= 65521, b %= 65521;
      return (a & 255) << 24 | (a & 65280) << 8 | (b & 255) << 8 | b >> 8;
    }
  };
};
var dopt = function(dat, opt, pre, post2, st) {
  if (!st) {
    st = { l: 1 };
    if (opt.dictionary) {
      var dict = opt.dictionary.subarray(-32768);
      var newDat = new u8(dict.length + dat.length);
      newDat.set(dict);
      newDat.set(dat, dict.length);
      dat = newDat;
      st.w = dict.length;
    }
  }
  return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post2, st);
};
var wbytes = function(d, b, v) {
  for (; v; ++b)
    d[b] = v, v >>>= 8;
};
var zlh = function(c, o) {
  var lv = o.level, fl2 = lv == 0 ? 0 : lv < 6 ? 1 : lv == 9 ? 3 : 2;
  c[0] = 120, c[1] = fl2 << 6 | (o.dictionary && 32);
  c[1] |= 31 - (c[0] << 8 | c[1]) % 31;
  if (o.dictionary) {
    var h = adler();
    h.p(o.dictionary);
    wbytes(c, 2, h.d());
  }
};
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
function zlibSync(data, opts) {
  if (!opts)
    opts = {};
  var a = adler();
  a.p(data);
  var d = dopt(data, opts, opts.dictionary ? 6 : 2, 4);
  return zlh(d, opts), wbytes(d, d.length - 4, a.d()), d;
}
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
function writeCrc(buffer, length) {
  buffer.writeUint32(crc(new Uint8Array(buffer.buffer, buffer.byteOffset + buffer.offset - length, length), length));
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
function writeSignature(buffer) {
  buffer.writeBytes(pngSignature);
}
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
function encodetEXt(buffer, keyword, text2) {
  validateKeyword(keyword);
  validateLatin1(text2);
  const length = keyword.length + 1 + text2.length;
  buffer.writeUint32(length);
  buffer.writeChars(textChunkName);
  buffer.writeChars(keyword);
  buffer.writeByte(NULL);
  buffer.writeChars(text2);
  writeCrc(buffer, length + 4);
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
      const frame2 = this._frames.at(i2);
      if (frame2) {
        frame2.data = decodeInterlaceNull({
          data: frame2.data,
          width: frame2.width,
          height: frame2.height,
          channels: this._apng.channels,
          depth: this._apng.depth
        });
        if (this._hasPalette) {
          this._apng.palette = this._palette;
        }
        if (this._hasTransparency) {
          this._apng.transparency = this._transparency;
        }
        if (i2 === 0 || frame2.xOffset === 0 && frame2.yOffset === 0 && frame2.width === this._png.width && frame2.height === this._png.height) {
          newFrame.data = frame2.data;
        } else {
          const prevFrame = this._apng.frames.at(i2 - 1);
          this.disposeFrame(frame2, prevFrame, newFrame);
          this.addFrameDataToCanvas(newFrame, frame2);
        }
        this._apng.frames.push(newFrame);
      }
    }
    return this._apng;
  }
  disposeFrame(frame2, prevFrame, imageFrame) {
    switch (frame2.disposeOp) {
      case DisposeOpType.NONE:
        break;
      case DisposeOpType.BACKGROUND:
        for (let row = 0; row < this._png.height; row++) {
          for (let col = 0; col < this._png.width; col++) {
            const index = (row * frame2.width + col) * this._png.channels;
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
  addFrameDataToCanvas(imageFrame, frame2) {
    const maxValue = 1 << this._png.depth;
    const calculatePixelIndices = (row, col) => {
      const index = ((row + frame2.yOffset) * this._png.width + frame2.xOffset + col) * this._png.channels;
      const frameIndex = (row * frame2.width + col) * this._png.channels;
      return { index, frameIndex };
    };
    switch (frame2.blendOp) {
      case BlendOpType.SOURCE:
        for (let row = 0; row < frame2.height; row++) {
          for (let col = 0; col < frame2.width; col++) {
            const { index, frameIndex } = calculatePixelIndices(row, col);
            for (let channel = 0; channel < this._png.channels; channel++) {
              imageFrame.data[index + channel] = frame2.data[frameIndex + channel];
            }
          }
        }
        break;
      // https://www.w3.org/TR/png-3/#13Alpha-channel-processing
      case BlendOpType.OVER:
        for (let row = 0; row < frame2.height; row++) {
          for (let col = 0; col < frame2.width; col++) {
            const { index, frameIndex } = calculatePixelIndices(row, col);
            for (let channel = 0; channel < this._png.channels; channel++) {
              const sourceAlpha = frame2.data[frameIndex + this._png.channels - 1] / maxValue;
              const foregroundValue = channel % (this._png.channels - 1) === 0 ? 1 : frame2.data[frameIndex + channel];
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

// ../image-codecs/node_modules/.pnpm/fast-png@8.0.0_patch_hash=c_1ada7191b11ba20b728ed8d72f7f7bd4/node_modules/fast-png/lib/png_encoder.js
var defaultZlibOptions = {
  level: 3
};
var PngEncoder = class extends IOBuffer {
  _png;
  _zlibOptions;
  _colorType;
  _interlaceMethod;
  constructor(data, options = {}) {
    super();
    this._colorType = ColorType.UNKNOWN;
    this._zlibOptions = { ...defaultZlibOptions, ...options.zlib };
    this._png = this._checkData(data);
    this._interlaceMethod = (options.interlace === "Adam7" ? InterlaceMethod.ADAM7 : InterlaceMethod.NO_INTERLACE) ?? InterlaceMethod.NO_INTERLACE;
    this.setBigEndian();
  }
  encode() {
    writeSignature(this);
    this.encodeIHDR();
    if (this._png.palette) {
      this.encodePLTE();
      if (this._png.palette[0].length === 4) {
        this.encodeTRNS();
      }
    }
    this.encodeData();
    if (this._png.text) {
      for (const [keyword, text2] of Object.entries(this._png.text)) {
        encodetEXt(this, keyword, text2);
      }
    }
    this.encodeIEND();
    return this.toArray();
  }
  // https://www.w3.org/TR/PNG/#11IHDR
  encodeIHDR() {
    this.writeUint32(13);
    this.writeChars("IHDR");
    this.writeUint32(this._png.width);
    this.writeUint32(this._png.height);
    this.writeByte(this._png.depth);
    this.writeByte(this._colorType);
    this.writeByte(CompressionMethod.DEFLATE);
    this.writeByte(FilterMethod.ADAPTIVE);
    this.writeByte(this._interlaceMethod);
    writeCrc(this, 17);
  }
  // https://www.w3.org/TR/PNG/#11IEND
  encodeIEND() {
    this.writeUint32(0);
    this.writeChars("IEND");
    writeCrc(this, 4);
  }
  encodePLTE() {
    const paletteLength = this._png.palette?.length * 3;
    this.writeUint32(paletteLength);
    this.writeChars("PLTE");
    for (const color of this._png.palette) {
      this.writeByte(color[0]);
      this.writeByte(color[1]);
      this.writeByte(color[2]);
    }
    writeCrc(this, 4 + paletteLength);
  }
  encodeTRNS() {
    const alpha = this._png.palette.filter((color) => {
      return color.at(-1) !== 255;
    });
    this.writeUint32(alpha.length);
    this.writeChars("tRNS");
    for (const el of alpha) {
      this.writeByte(el.at(-1));
    }
    writeCrc(this, 4 + alpha.length);
  }
  // https://www.w3.org/TR/PNG/#11IDAT
  encodeIDAT(data) {
    this.writeUint32(data.length);
    this.writeChars("IDAT");
    this.writeBytes(data);
    writeCrc(this, data.length + 4);
  }
  encodeData() {
    const { width, height, channels, depth, data } = this._png;
    const slotsPerLine = depth <= 8 ? Math.ceil(width * depth / 8) * channels : Math.ceil(width * depth / 8 * channels / 2);
    const newData = new IOBuffer().setBigEndian();
    let offset = 0;
    if (this._interlaceMethod === InterlaceMethod.NO_INTERLACE) {
      for (let i2 = 0; i2 < height; i2++) {
        newData.writeByte(0);
        if (depth === 16) {
          offset = writeDataUint16(data, newData, slotsPerLine, offset);
        } else {
          offset = writeDataBytes(data, newData, slotsPerLine, offset);
        }
      }
    } else if (this._interlaceMethod === InterlaceMethod.ADAM7) {
      offset = writeDataInterlaced(this._png, data, newData, offset);
    }
    const buffer = newData.toArray();
    const compressed = zlibSync(buffer, this._zlibOptions);
    this.encodeIDAT(compressed);
  }
  _checkData(data) {
    const { colorType, channels, depth } = getColorType(data, data.palette);
    const png = {
      width: checkInteger(data.width, "width"),
      height: checkInteger(data.height, "height"),
      channels,
      data: data.data,
      depth,
      text: data.text,
      palette: data.palette
    };
    this._colorType = colorType;
    const expectedSize = depth < 8 ? Math.ceil(png.width * depth / 8) * png.height * channels : png.width * png.height * channels;
    if (png.data.length !== expectedSize) {
      throw new RangeError(`wrong data size. Found ${png.data.length}, expected ${expectedSize}`);
    }
    return png;
  }
};
function checkInteger(value, name) {
  if (Number.isInteger(value) && value > 0) {
    return value;
  }
  throw new TypeError(`${name} must be a positive integer`);
}
function getColorType(data, palette) {
  const { channels = 4, depth = 8 } = data;
  if (channels !== 4 && channels !== 3 && channels !== 2 && channels !== 1) {
    throw new RangeError(`unsupported number of channels: ${channels}`);
  }
  const returnValue = {
    channels,
    depth,
    colorType: ColorType.UNKNOWN
  };
  switch (channels) {
    case 4:
      returnValue.colorType = ColorType.TRUECOLOUR_ALPHA;
      break;
    case 3:
      returnValue.colorType = ColorType.TRUECOLOUR;
      break;
    case 1:
      if (palette) {
        returnValue.colorType = ColorType.INDEXED_COLOUR;
      } else {
        returnValue.colorType = ColorType.GREYSCALE;
      }
      break;
    case 2:
      returnValue.colorType = ColorType.GREYSCALE_ALPHA;
      break;
    default:
      throw new Error("unsupported number of channels");
  }
  return returnValue;
}
function writeDataBytes(data, newData, slotsPerLine, offset) {
  for (let j = 0; j < slotsPerLine; j++) {
    newData.writeByte(data[offset++]);
  }
  return offset;
}
function writeDataInterlaced(imageData, data, newData, offset) {
  const passes = [
    { x: 0, y: 0, xStep: 8, yStep: 8 },
    { x: 4, y: 0, xStep: 8, yStep: 8 },
    { x: 0, y: 4, xStep: 4, yStep: 8 },
    { x: 2, y: 0, xStep: 4, yStep: 4 },
    { x: 0, y: 2, xStep: 2, yStep: 4 },
    { x: 1, y: 0, xStep: 2, yStep: 2 },
    { x: 0, y: 1, xStep: 1, yStep: 2 }
  ];
  const { width, height, channels, depth } = imageData;
  let pixelSize;
  if (depth === 16) {
    pixelSize = channels * depth / 8 / 2;
  } else {
    pixelSize = channels * depth / 8;
  }
  for (let passIndex = 0; passIndex < 7; passIndex++) {
    const pass = passes[passIndex];
    const passWidth = Math.floor((width - pass.x + pass.xStep - 1) / pass.xStep);
    const passHeight = Math.floor((height - pass.y + pass.yStep - 1) / pass.yStep);
    if (passWidth <= 0 || passHeight <= 0)
      continue;
    const passLineBytes = passWidth * pixelSize;
    for (let y = 0; y < passHeight; y++) {
      const imageY = pass.y + y * pass.yStep;
      const rawScanline = depth <= 8 ? new Uint8Array(passLineBytes) : new Uint16Array(passLineBytes);
      let rawOffset = 0;
      for (let x2 = 0; x2 < passWidth; x2++) {
        const imageX = pass.x + x2 * pass.xStep;
        if (imageX < width && imageY < height) {
          const srcPos = (imageY * width + imageX) * pixelSize;
          for (let i2 = 0; i2 < pixelSize; i2++) {
            rawScanline[rawOffset++] = data[srcPos + i2];
          }
        }
      }
      newData.writeByte(0);
      if (depth === 8) {
        newData.writeBytes(rawScanline);
      } else if (depth === 16) {
        for (const value of rawScanline) {
          newData.writeByte(value >> 8 & 255);
          newData.writeByte(value & 255);
        }
      }
    }
  }
  return offset;
}
function writeDataUint16(data, newData, slotsPerLine, offset) {
  for (let j = 0; j < slotsPerLine; j++) {
    newData.writeUint16(data[offset++]);
  }
  return offset;
}

// ../image-codecs/node_modules/.pnpm/fast-png@8.0.0_patch_hash=c_1ada7191b11ba20b728ed8d72f7f7bd4/node_modules/fast-png/lib/index.js
function decodePng(data, options) {
  const decoder = new PngDecoder(data, options);
  return decoder.decode();
}
function encodePng(png, options) {
  const encoder3 = new PngEncoder(png, options);
  return encoder3.encode();
}

// apps/studio/src/capture-png.mjs
var straight = new Uint8Array(256 * 256);
for (let alpha = 1; alpha < 256; alpha++) for (let byte = 0; byte < 256; byte++) {
  const encoded = byte / 255;
  const premultiplied = encoded <= 0.04045 ? encoded / 12.92 : ((encoded + 0.055) / 1.055) ** 2.4;
  const linear = Math.min(1, premultiplied * 255 / alpha);
  straight[alpha * 256 + byte] = Math.round(255 * (linear <= 31308e-7 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055));
}
function encodeCapturedTarget(pixels, width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 1920 || height > 1080 || !(pixels instanceof Uint8Array) || pixels.byteLength !== width * height * 4) throw Error("Invalid capture target readback");
  const data = new Uint8Array(pixels.length);
  for (let at = 0; at < pixels.length; at += 4) {
    const alpha = pixels[at + 3], row = alpha * 256;
    data[at] = straight[row + pixels[at]];
    data[at + 1] = straight[row + pixels[at + 1]];
    data[at + 2] = straight[row + pixels[at + 2]];
    data[at + 3] = alpha;
  }
  const png = encodePng({ width, height, channels: 4, depth: 8, data });
  if (png.byteLength > 8388608) throw Error("Capture exceeds 8 MiB");
  return png;
}

// packages/runtime/src/clock.ts
var RuntimeClock = class {
  nowMs;
  playback;
  accumulatedMs = 0;
  anchorMs = 0;
  lastSampleMs = 0;
  epoch = 0;
  constructor(nowMs, initialPlayback = "paused") {
    if (typeof nowMs !== "function") throw TypeError("An injected monotonic clock is required");
    if (initialPlayback !== "paused" && initialPlayback !== "playing") throw TypeError("Invalid initial playback state");
    this.nowMs = nowMs;
    this.playback = initialPlayback;
    this.anchorMs = this.sample();
  }
  snapshot() {
    return this.at(this.sample());
  }
  play() {
    const now2 = this.sample();
    if (this.playback === "paused") {
      this.anchorMs = now2;
      this.playback = "playing";
    }
    return this.at(now2);
  }
  pause() {
    const now2 = this.sample();
    if (this.playback === "playing") {
      this.accumulatedMs += now2 - this.anchorMs;
      this.playback = "paused";
    }
    return this.at(now2);
  }
  reset() {
    const now2 = this.sample();
    if (this.epoch === Number.MAX_SAFE_INTEGER) throw RangeError("Clock epoch exhausted; a new runtime generation is required");
    this.accumulatedMs = 0;
    this.anchorMs = now2;
    this.epoch++;
    return this.at(now2);
  }
  sample() {
    const now2 = this.nowMs();
    if (!Number.isFinite(now2) || now2 < this.lastSampleMs || now2 > Number.MAX_SAFE_INTEGER) {
      throw RangeError("Monotonic clock must provide finite nonnegative nondecreasing milliseconds within the safe range");
    }
    this.lastSampleMs = now2;
    return now2;
  }
  at(now2) {
    const elapsed = this.accumulatedMs + (this.playback === "playing" ? now2 - this.anchorMs : 0);
    return Object.freeze({ playback: this.playback, timeSeconds: elapsed / 1e3, clockEpoch: this.epoch });
  }
};

// packages/runtime/src/seed.ts
var SeededRandom = class {
  seed;
  state;
  constructor(seed) {
    this.seed = this.validate(seed);
    this.state = this.seed;
  }
  next() {
    this.state = this.state + 1831565813 >>> 0;
    let value = this.state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  }
  reset(seed = this.seed) {
    const validated = this.validate(seed);
    this.seed = validated;
    this.state = validated;
  }
  validate(seed) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw RangeError("Seed must be an unsigned 32-bit integer");
    return seed;
  }
};

// packages/assets/src/limits.mjs
var assetLimits = Object.freeze({ count: 4, imageBytes: 786486, totalBytes: 1048576, rgbaBytes: 2097152, dimension: 512, pathCharacters: 240 });

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
  let frame2, jfif = false, adobe, exifSeen = false, orientation = 1, restartInterval = 0, ended = false;
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
      if (!frame2 || !scans || at !== bytes.length) fail2("empty image or trailing bytes");
      for (const component of frame2.components.values()) if (component.approximation.some((n) => n < 0)) fail2("incomplete component scans");
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
      if (frame2 || length < 8) fail2("duplicate or truncated frame");
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
      frame2 = { width, height, components, maxH, maxV, progressive: marker === 194 };
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
      if (!frame2 || ++scans > 16 || start === end) fail2("missing frame or excessive scans");
      const count = bytes[start];
      exact2(1 + count * 2 + 3);
      if (count < 1 || count > frame2.components.size) fail2("invalid scan component count");
      const ss = bytes[end - 3], se = bytes[end - 2], ah = bytes[end - 1] >>> 4, al = bytes[end - 1] & 15;
      if (ss > se || se > 63 || ah > 13 || al > 13 || ah !== 0 && ah !== al + 1) fail2("invalid spectral or approximation range");
      if (!frame2.progressive && (ss !== 0 || se !== 63 || ah || al)) fail2("invalid baseline scan");
      if (frame2.progressive && (ss === 0 && se !== 0 || ss > 0 && count !== 1)) fail2("invalid progressive scan");
      const selected = [], ids2 = /* @__PURE__ */ new Set();
      for (let i2 = 0; i2 < count; i2++) {
        const id = bytes[start + 1 + i2 * 2], selector = bytes[start + 2 + i2 * 2], dc = selector >>> 4, ac = selector & 15;
        const component = frame2.components.get(id);
        if (!component || ids2.has(id) || dc > 3 || ac > 3 || !quant.has(component.q) || !frame2.progressive && quant.get(component.q) !== 0) fail2("invalid scan selector or missing quantization table");
        if (ss === 0 && ah === 0 && !huffman.has(dc) || se > 0 && !huffman.has(16 | ac)) fail2("missing Huffman table");
        if (!frame2.progressive && !huffman.get(16 | ac).baselineCompatible) fail2("invalid baseline Huffman symbol");
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
      const units = count === 1 ? Math.ceil(Math.ceil(frame2.width / 8) * selected[0].h / frame2.maxH) * Math.ceil(Math.ceil(frame2.height / 8) * selected[0].v / frame2.maxV) : Math.ceil(frame2.width / (8 * frame2.maxH)) * Math.ceil(frame2.height / (8 * frame2.maxV));
      if (restarts !== (restartInterval ? Math.floor((units - 1) / restartInterval) : 0)) fail2("restart count does not match MCU budget");
      at = p;
      continue;
    } else fail2(`unsupported marker 0x${marker.toString(16)}`);
    at = end;
  }
  if (!ended) fail2("missing EOI");
  if (adobe !== void 0 && frame2.components.size !== 3) fail2("Adobe transform requires three components");
  if (jfif && adobe === 0) fail2("conflicting JFIF and RGB color declarations");
  const ids = [...frame2.components.keys()].join(",");
  if (frame2.components.size === 3 && !jfif && adobe === void 0 && ids !== "1,2,3") fail2("ambiguous three-component color transform");
  return { ...frame2, orientation, colorTransform: adobe !== 0 };
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
    const descriptor2 = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== "string" || !descriptor2 || !descriptor2.enumerable || !Object.hasOwn(descriptor2, "value") || fields && !fields.includes(key)) fail3("Asset fields must be enumerable own data properties", path);
    snapshot[key] = descriptor2.value;
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
function validateMedia(path, descriptor2) {
  const expected = path.endsWith(".bmp") ? "image/bmp" : path.endsWith(".png") ? "image/png" : "image/jpeg";
  if (descriptor2.mediaType !== expected || descriptor2.encoding !== "base64") fail3("Image extension/media type must match and encoding must be base64", path);
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
    const descriptor2 = dataRecord(records[path], derived ? derivedFields : sourceFields, path);
    validateMedia(path, descriptor2);
    let bytes, info, pixels;
    try {
      bytes = decodeCanonicalBase64(descriptor2.data);
      if (totalBytes + bytes.byteLength > assetLimits.totalBytes) fail3("Aggregate asset byte budget exceeded", path, true);
      if (descriptor2.mediaType === "image/bmp") {
        info = validateBmp(bytes);
        if (info.rgbaByteLength > assetLimits.rgbaBytes - totalRgba) fail3("Aggregate decoded image budget exceeded", path, true);
        pixels = { ...decodeBmp(bytes), colorSpace: "srgb", alphaMode: "straight" };
      } else {
        pixels = (descriptor2.mediaType === "image/png" ? decodePng2 : decodeJpeg)(bytes, { maxRgbaBytes: assetLimits.rgbaBytes - totalRgba });
        info = { width: pixels.width, height: pixels.height, byteLength: bytes.byteLength, rgbaByteLength: pixels.data.byteLength };
      }
    } catch (error) {
      fail3(error.message, path, error.code === "QUOTA_EXCEEDED");
    }
    totalBytes += info.byteLength;
    totalRgba += info.rgbaByteLength;
    if (totalBytes > assetLimits.totalBytes || totalRgba > assetLimits.rgbaBytes) fail3("Aggregate asset byte budget exceeded", path, true);
    const normalized = { mediaType: descriptor2.mediaType, encoding: "base64", data: descriptor2.data };
    if (derived) {
      if (descriptor2.byteLength !== info.byteLength || descriptor2.width !== info.width || descriptor2.height !== info.height || typeof descriptor2.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(descriptor2.sha256)) fail3("Invalid derived asset metadata", path);
      Object.assign(normalized, { byteLength: info.byteLength, sha256: descriptor2.sha256, width: info.width, height: info.height });
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
    const { mediaType, byteLength, sha256: sha2563, width, height } = assets[path];
    return { path, mediaType, byteLength, sha256: sha2563, width, height };
  }));
}
async function digest(bytes, hashBytes) {
  const hash = await hashBytes(bytes);
  if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) fail3("Trusted hash callback must return lowercase SHA-256 hex");
  return hash;
}
async function verifyDerivedAssets(input, expectedAssetSetHash, hashBytes) {
  const { assets, decoded } = admit(input, true), sourceAssets = {};
  for (const { path, bytes } of decoded) {
    if (await digest(bytes, hashBytes) !== assets[path].sha256) fail3("Asset SHA-256 mismatch", path);
    const { mediaType, encoding, data } = assets[path];
    sourceAssets[path] = Object.freeze({ mediaType, encoding, data });
  }
  const assetSetHash = await digest(new TextEncoder().encode(identity(assets)), hashBytes);
  if (assetSetHash !== expectedAssetSetHash) fail3("Asset set SHA-256 mismatch");
  Object.freeze(sourceAssets);
  admissions.set(sourceAssets, { assets: sourceAssets, decoded });
  return Object.freeze({ assets, assetSetHash, sourceAssets });
}
function createReadonlyAssetMap(input) {
  return readonlyMap(admit(input).decoded, false);
}
function createReadonlyImageMap(input) {
  return readonlyMap(admit(input).decoded, true);
}
function readonlyMap(decoded, images) {
  const Bytes = Uint8Array, freeze5 = Object.freeze, create = Object.create, apply = Reflect.apply;
  const iteratorSymbol = Symbol.iterator, count = decoded.length;
  const copy = (index) => {
    const row = decoded[index], length = images ? row.info.rgbaByteLength : row.info.byteLength, out = new Bytes(length);
    const bytes = images ? row.pixels.data : row.bytes;
    for (let i2 = 0; i2 < length; i2++) out[i2] = bytes[i2];
    return images ? freeze5({ width: row.info.width, height: row.info.height, colorSpace: "srgb", alphaMode: "straight", data: out }) : out;
  };
  const lookup = (key) => {
    for (let i2 = 0; i2 < count; i2++) if (decoded[i2].path === key) return i2;
    return -1;
  };
  const iterator = (kind) => {
    let index = 0;
    const result = create(null);
    result.next = () => {
      if (index === count) return { value: void 0, done: true };
      const i2 = index++, key = decoded[i2].path;
      return { value: kind === 0 ? key : kind === 1 ? copy(i2) : [key, copy(i2)], done: false };
    };
    result[iteratorSymbol] = () => result;
    return freeze5(result);
  };
  const facade = create(null);
  facade.size = count;
  facade.has = (key) => lookup(key) !== -1;
  facade.get = (key) => {
    const i2 = lookup(key);
    return i2 === -1 ? void 0 : copy(i2);
  };
  facade.keys = () => iterator(0);
  facade.values = () => iterator(1);
  facade.entries = () => iterator(2);
  facade[iteratorSymbol] = facade.entries;
  facade.forEach = (callback, thisArg) => {
    if (typeof callback !== "function") throw new TypeError("Asset forEach callback must be a function");
    for (let i2 = 0; i2 < count; i2++) apply(callback, thisArg, [copy(i2), decoded[i2].path, facade]);
  };
  return freeze5(facade);
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
    const descriptor2 = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== "string" || !descriptor2 || !descriptor2.enumerable || !Object.hasOwn(descriptor2, "value")) throw violation("Expected enumerable own data properties");
    result[key] = descriptor2.value;
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
    const descriptor2 = Object.getOwnPropertyDescriptor(input, key);
    if (typeof key !== "string" || !descriptor2?.enumerable || !Object.hasOwn(descriptor2, "value")) {
      invalid(path, "expected enumerable own data properties");
    }
    result[key] = descriptor2.value;
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
    const descriptor2 = Object.getOwnPropertyDescriptor(input, String(i2));
    if (!descriptor2?.enumerable || !Object.hasOwn(descriptor2, "value")) invalid("controls", "expected dense own data array elements");
    const raw = record(descriptor2.value, `controls[${i2}]`);
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
async function digest2(body, hashBytes) {
  return hashBytes(new TextEncoder().encode(JSON.stringify(body)));
}
async function verifyLinked(input, hashBytes, expectedArtifact) {
  const a = snapshotRecord(input), body = linkedBody(a);
  requireHash(a.linkedHash);
  if (body.linkedVersion === 2 || body.linkedVersion === 3) {
    const verified = await verifyDerivedAssets(body.assets, body.assetSetHash, hashBytes);
    body.assets = verified.assets;
  }
  if (body.linkedVersion === 3 && await hashBytes(new TextEncoder().encode(canonicalControlSchemaJson(body.controls))) !== body.controlSchemaHash) throw violation("Control schema hash mismatch");
  if (expectedArtifact && (body.bundleHash !== expectedArtifact.bundleHash || (body.linkedVersion ?? 1) !== (expectedArtifact.artifactVersion ?? 1) || body.linkedVersion && body.assetSetHash !== expectedArtifact.assetSetHash || body.linkedVersion === 3 && (body.controlSchemaHash !== expectedArtifact.controlSchemaHash || canonicalControlSchemaJson(body.controls) !== canonicalControlSchemaJson(expectedArtifact.controls)))) throw violation("Linked result artifact/version/schema identity mismatch");
  if (await digest2(body, hashBytes) !== a.linkedHash) throw violation("Linked result hash mismatch");
  return { ...body, linkedHash: a.linkedHash };
}

// apps/studio/src/authored-worker-assets.mjs
var digest3 = crypto.subtle.digest.bind(crypto.subtle);
async function sha256(bytes) {
  const hash = new Uint8Array(await digest3("SHA-256", bytes));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
var limit = 16777216;
async function loadAuthoredModule(message, importModule) {
  message = snapshotRecord(message);
  let moduleSource, assets, images;
  if (Object.hasOwn(message, "linked")) {
    if (["moduleSource", "assets", "linkedVersion", "artifactVersion", "sourceVersion", "assetSetHash"].some((key) => Object.hasOwn(message, key))) throw Error("Ambiguous linked module initialization");
    if (new TextEncoder().encode(JSON.stringify(message.linked)).byteLength > limit) throw Error("Linked payload exceeds 16 MiB");
    const linked = await verifyLinked(message.linked, sha256);
    if (new TextEncoder().encode(JSON.stringify(linked)).byteLength > limit) throw Error("Linked payload exceeds 16 MiB");
    const sourceAssets = linked.linkedVersion === 2 || linked.linkedVersion === 3 ? (await verifyDerivedAssets(linked.assets, linked.assetSetHash, sha256)).sourceAssets : {};
    assets = createReadonlyAssetMap(sourceAssets);
    images = createReadonlyImageMap(sourceAssets);
    moduleSource = linked.code;
  } else {
    if (["assets", "linkedVersion", "artifactVersion", "sourceVersion", "assetSetHash"].some((key) => Object.hasOwn(message, key))) throw Error("Assets require a verified linked envelope");
    moduleSource = message.moduleSource;
    if (typeof moduleSource !== "string" || new TextEncoder().encode(moduleSource).byteLength > limit) throw Error("Invalid linked module");
    assets = createReadonlyAssetMap({});
    images = createReadonlyImageMap({});
  }
  return { module: await importModule(moduleSource), assets, images };
}

// apps/studio/src/controls/control-state.ts
var LEGACY_CONTROL_SCHEMA = normalizeControlSchema([{ id: "intensity", type: "number", label: "Intensity", default: 0.5, min: 0, max: 1, changeCost: "live" }]);
var LEGACY_CONTROL_SCHEMA_HASH = "2f686a688523e2aa6e5368cd286974b87b324cfa4c67507563658b25cadd5a87";
async function sha2562(bytes) {
  const digest4 = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return Array.from(new Uint8Array(digest4), (value) => value.toString(16).padStart(2, "0")).join("");
}

// apps/studio/src/controls/worker-control-state.mjs
var ownKeys = Reflect.ownKeys;
var getDescriptor = Object.getOwnPropertyDescriptor;
var getPrototype = Object.getPrototypeOf;
var defineProperty = Object.defineProperty;
var freeze = Object.freeze;
var createObject = Object.create;
var isArray = Array.isArray;
var objectPrototype = Object.prototype;
var arrayPrototype = Array.prototype;
var hasOwn = Function.prototype.call.bind(Object.prototype.hasOwnProperty);
var isFiniteNumber = Number.isFinite;
var isSafeInteger = Number.isSafeInteger;
var RuntimeError = Error;
function bad(message) {
  throw new RuntimeError(message);
}
function own(input, key) {
  const descriptor2 = getDescriptor(input, key);
  if (!descriptor2 || !descriptor2.enumerable || !hasOwn(descriptor2, "value")) bad("Control schema requires own data properties");
  return descriptor2.value;
}
function record2(input) {
  if (!input || typeof input !== "object" || getPrototype(input) !== objectPrototype && getPrototype(input) !== null) bad("Control schema requires plain records");
  return ownKeys(input);
}
async function prepareWorkerControlState(message) {
  const sdkVersion = message.sdkVersion ?? "0.1.0";
  if (sdkVersion !== "0.1.0" && sdkVersion !== "0.2.0") bad("Unsupported visual SDK");
  const schema = normalizeControlSchema(message.controlSchema ?? (sdkVersion === "0.1.0" ? LEGACY_CONTROL_SCHEMA : void 0));
  const schemaHash = await sha2562(new TextEncoder().encode(canonicalControlSchemaJson(schema)));
  if ((message.controlSchemaHash ?? (sdkVersion === "0.1.0" ? LEGACY_CONTROL_SCHEMA_HASH : void 0)) !== schemaHash) bad("Control schema hash mismatch");
  let values2 = validateControlSnapshot(schema, message.controls), sequence = 0;
  const fields = schema.map((row) => ownKeys(row));
  function validateValues(input) {
    if (record2(input).length !== schema.length) bad("Invalid full control snapshot");
    const result = createObject(objectPrototype);
    for (let i2 = 0; i2 < schema.length; i2++) {
      const control = schema[i2], value = own(input, control.id);
      if (typeof value !== "number" || !isFiniteNumber(value) || value < control.min || value > control.max) bad("Invalid value for " + control.id);
      defineProperty(result, control.id, { value: value === 0 ? 0 : value, enumerable: true });
    }
    return freeze(result);
  }
  function checkDefinition(module) {
    const definition2 = own(module, "default");
    record2(definition2);
    if (own(definition2, "sdkVersion") !== sdkVersion) bad("Visual SDK mismatch");
    const declared = own(definition2, "controls");
    if (!isArray(declared) || getPrototype(declared) !== arrayPrototype || getDescriptor(declared, "length").value !== schema.length || ownKeys(declared).length !== schema.length + 1) bad("Visual control schema mismatch");
    for (let i2 = 0; i2 < schema.length; i2++) {
      const row = own(declared, "" + i2), expected = schema[i2], keys = fields[i2];
      if (record2(row).length !== keys.length) bad("Visual control schema mismatch");
      for (let j = 0; j < keys.length; j++) if (own(row, keys[j]) !== expected[keys[j]]) bad("Visual control schema mismatch");
    }
    const create = own(definition2, "create");
    if (typeof create !== "function") bad("Invalid visual create function");
    return create;
  }
  return freeze({
    checkDefinition,
    values: () => values2,
    apply(input, nextSequence, hash) {
      if (!isSafeInteger(nextSequence) || nextSequence <= sequence || sdkVersion === "0.2.0" && hash !== schemaHash) bad("Invalid control snapshot sequence or schema");
      const next = validateValues(input);
      values2 = next;
      sequence = nextSequence;
    },
    state: () => ({ sdkVersion, controlSchemaHash: schemaHash, controls: values2, controlSequence: sequence, ...sdkVersion === "0.1.0" ? { intensity: values2.intensity } : {} })
  });
}

// packages/performance/collection-mode.mjs
var GPU_SAMPLE_EVERY = 30;
var GPU_SAMPLING_POLICY = "one in 30 frames (frame IDs 1,31,61,...)";
function collectionMode(value = "routine") {
  if (value !== "baseline" && value !== "routine") throw Error("Invalid performance collection mode");
  return value;
}
function gpuSampleFrame(frame2) {
  return (frame2 - 1) % GPU_SAMPLE_EVERY === 0;
}

// packages/performance/live.mjs
var freeze2 = Object.freeze;
var finite2 = Number.isFinite;
var integer = Number.isSafeInteger;
var ceil = Math.ceil;
var max2 = Math.max;
var sort = Function.call.bind(Array.prototype.sort);
var push = Function.call.bind(Array.prototype.push);
var FloatBuffer = Float64Array;
var LIVE_LIMITS = freeze2({ records: 4096, windowMs: 12e4, summaryMs: 500 });
function createFrameCollector({ startMs, capacity = 4096, windowMs = 12e4, mode = "routine" } = {}) {
  mode = collectionMode(mode);
  if (!finite2(startMs) || startMs < 0 || !integer(capacity) || capacity < 1 || capacity > 4096 || !integer(windowMs) || windowMs < 1 || windowMs > 12e4) throw Error("Invalid bounded collector options");
  const records = mode === "routine" ? new FloatBuffer(capacity * 9) : null;
  let gpuExpected = 0;
  let count = 0, completed = 0, lost = 0, invalid2 = 0, totalLost = 0, totalInvalid = 0, lastFrame = 0, lastAt = startMs, windowStart = startMs, sequence = 0;
  const distribution = (values2, expected, reason) => {
    const n = values2.length, missing = max2(0, expected - n);
    const base = {
      unit: "ms",
      availability: n ? "available" : "pending",
      sampleCount: n,
      expectedCount: expected,
      missingCount: missing,
      samplingPolicy: "all completed frames in this summary interval",
      validity: missing || reason ? "incomplete" : "complete",
      gate: "not_evaluated"
    };
    if (reason) base.reason = reason;
    if (n) {
      sort(values2, (a, b) => a - b);
      base.p50 = values2[ceil(n * 0.5) - 1];
      base.p95 = values2[ceil(n * 0.95) - 1];
      base.p99 = values2[ceil(n * 0.99) - 1];
      base.max = values2[n - 1];
    }
    return freeze2(base);
  };
  return freeze2({
    record(at, frame2, update, renderCall, queueWait, asyncRender, renderAwait = 0) {
      if (!finite2(at) || at < lastAt || !integer(frame2) || frame2 <= lastFrame) {
        invalid2++;
        totalInvalid++;
        return false;
      }
      lastAt = at;
      lastFrame = frame2;
      if (mode === "baseline") {
        completed++;
        return true;
      }
      if (gpuSampleFrame(frame2)) gpuExpected++;
      if (!finite2(update) || update < 0 || !finite2(renderCall) || renderCall < 0 || !finite2(queueWait) || queueWait < 0 || !finite2(renderAwait) || renderAwait < 0 || typeof asyncRender !== "boolean") {
        invalid2++;
        totalInvalid++;
        return false;
      }
      completed++;
      if (count === capacity) {
        lost++;
        totalLost++;
        return false;
      }
      const i2 = count++ * 9;
      records[i2] = at;
      records[i2 + 1] = frame2;
      records[i2 + 2] = update;
      records[i2 + 3] = renderCall;
      records[i2 + 4] = queueWait;
      records[i2 + 5] = asyncRender ? 1 : 0;
      records[i2 + 6] = renderAwait;
      records[i2 + 7] = -1;
      records[i2 + 8] = 0;
      return true;
    },
    recordGpu(frame2, ms, complete) {
      if (mode === "baseline" || !integer(frame2) || !gpuSampleFrame(frame2) || !finite2(ms) || ms < 0 || typeof complete !== "boolean") return false;
      for (let row = count - 1; row >= 0; row--) {
        const i2 = row * 9;
        if (records[i2 + 1] === frame2) {
          if (records[i2 + 7] >= 0) return false;
          records[i2 + 7] = ms;
          records[i2 + 8] = complete ? 1 : 0;
          return true;
        }
      }
      return false;
    },
    summary(now2, { timestampQuerySupported = null, timestampQueryEnabled = false, failedSamples = 0, droppedSamples = 0, pendingSamples = 0 } = {}) {
      if (!finite2(now2) || now2 < lastAt || now2 < windowStart) throw Error("Collector clock must be monotonic");
      const update = [], render = [], cpu = [], wait = [], awaited = [], gpu = [];
      let asyncCount = 0, expired = 0, gpuPartial = 0;
      for (let row = 0; row < count; row++) {
        const i2 = row * 9;
        if (records[i2] < now2 - windowMs) {
          expired++;
          continue;
        }
        push(update, records[i2 + 2]);
        push(render, records[i2 + 3]);
        push(cpu, records[i2 + 2] + records[i2 + 3]);
        push(wait, records[i2 + 4]);
        push(awaited, records[i2 + 6]);
        asyncCount += records[i2 + 5];
        if (records[i2 + 7] >= 0) {
          push(gpu, records[i2 + 7]);
          if (!records[i2 + 8]) gpuPartial++;
        }
      }
      const expected = completed + invalid2, reason = lost || invalid2 || expired ? "Telemetry lost, invalid or expired; duration distribution is incomplete" : void 0;
      const elapsed = now2 - windowStart;
      const disabled = freeze2({ unit: "ms", availability: "unsupported", reason: "Optional timing disabled in baseline mode", sampleCount: 0, expectedCount: 0, missingCount: 0, samplingPolicy: "none", validity: "incomplete", gate: "not_evaluated" });
      const cpuMetric = (values2, detail) => mode === "baseline" ? disabled : distribution(values2, expected, detail);
      const gpuMetric = timestampQueryEnabled && mode === "routine" ? distribution(gpu, gpuExpected, gpuPartial ? "GPU copies, uploads or clears outside passes are excluded" : reason) : null;
      const result = freeze2({
        schemaVersion: 1,
        mode,
        sequence: ++sequence,
        clockDomain: "dedicated-worker-monotonic-ms",
        windowStartMs: windowStart,
        windowEndMs: now2,
        lostRecords: totalLost,
        invalidRecords: totalInvalid,
        intervalLostRecords: lost,
        intervalInvalidRecords: invalid2,
        retainedRecords: cpu.length,
        produced: freeze2({
          unit: "Hz",
          availability: elapsed > 0 ? "available" : "pending",
          ...elapsed > 0 ? { value: completed * 1e3 / elapsed } : {},
          sampleCount: completed,
          expectedCount: completed + invalid2,
          missingCount: invalid2,
          samplingPolicy: "completed frames over independent summary interval",
          validity: invalid2 ? "incomplete" : "complete",
          gate: "not_evaluated"
        }),
        update: cpuMetric(update, reason),
        renderCall: cpuMetric(render, reason),
        cpuCall: cpuMetric(cpu, asyncCount ? "Asynchronous render continuation CPU work is not fully measured" : reason),
        renderAwait: cpuMetric(awaited, reason),
        queueWait: cpuMetric(wait, reason),
        gpu: freeze2({ ...mode === "baseline" ? disabled : gpuMetric ? { ...gpuMetric, samplingPolicy: GPU_SAMPLING_POLICY, validity: gpuMetric.validity === "complete" ? "sampled" : "incomplete" } : {
          unit: "ms",
          availability: "unsupported",
          reason: "GPU pass queries are unavailable; queue completion wait is not GPU duration",
          sampleCount: 0,
          expectedCount: gpuExpected,
          missingCount: gpuExpected,
          samplingPolicy: GPU_SAMPLING_POLICY,
          validity: "incomplete",
          gate: "not_evaluated"
        }, timestampQuerySupported, timestampQueryEnabled: mode === "routine" && timestampQueryEnabled, failedSamples, droppedSamples, pendingSamples })
      });
      count = 0;
      completed = 0;
      lost = 0;
      invalid2 = 0;
      gpuExpected = 0;
      windowStart = now2;
      return result;
    }
  });
}

// packages/performance/gpu-pass.mjs
var freeze3 = Object.freeze;
var define = Object.defineProperty;
var descriptor = Object.getOwnPropertyDescriptor;
var Uint64 = BigUint64Array;
var finite3 = Number.isFinite;
var integer2 = Number.isSafeInteger;
function createGpuPassTimer(device2, onSample, { mode = "routine", sampleFrame = gpuSampleFrame, captureRaw = false } = {}) {
  mode = collectionMode(mode);
  const supported = typeof device2.features?.has === "function" ? device2.features.has("timestamp-query") : null;
  let enabled = false, disposed = false, active = null, completedSamples = 0, failedSamples = 0, droppedSamples = 0, reason = "Timestamp queries unavailable";
  const slots = [], restores = [], commands = /* @__PURE__ */ new WeakMap();
  const status = () => freeze3({ timestampQuerySupported: supported, timestampQueryEnabled: enabled, completedSamples, failedSamples, droppedSamples, pendingSamples: slots.filter((s) => s.busy).length, reason });
  const replace = (object, key, fn) => {
    const old = descriptor(object, key);
    define(object, key, { value: fn, configurable: true, writable: true });
    restores.push(() => {
      if (old) define(object, key, old);
      else delete object[key];
    });
  };
  const closeFailed = (slot) => {
    void device2.popErrorScope().catch(() => {
    }).finally(() => {
      slot.busy = false;
    });
  };
  function release() {
    for (const restore of restores.splice(0).reverse()) try {
      restore();
    } catch {
    }
    for (const slot of slots) {
      try {
        slot.read.destroy();
      } catch {
      }
      try {
        slot.resolve.destroy();
      } catch {
      }
      try {
        slot.query.destroy();
      } catch {
      }
    }
  }
  const api = {
    status,
    begin(frame2) {
      if (!enabled || disposed) return;
      if (active) {
        active.invalid = true;
        failedSamples++;
        closeFailed(active);
        active = null;
      }
      if (!integer2(frame2) || frame2 < 1) {
        failedSamples++;
        return;
      }
      if (!sampleFrame(frame2)) return;
      const slot = slots.find((s) => !s.busy);
      if (!slot) {
        droppedSamples++;
        return;
      }
      device2.pushErrorScope("validation");
      slot.busy = true;
      slot.count = 0;
      slot.invalid = false;
      slot.nonPass = false;
      slot.frame = frame2;
      slot.submitted = 0;
      active = slot;
    },
    end() {
      const slot = active;
      active = null;
      if (!slot || disposed) return;
      if (slot.invalid || slot.count === 0 || slot.submitted === 0) {
        failedSamples++;
        closeFailed(slot);
        return;
      }
      let errors;
      try {
        const encoder3 = originalEncoder.call(device2);
        encoder3.resolveQuerySet(slot.query, 0, slot.count, slot.resolve, 0);
        encoder3.copyBufferToBuffer(slot.resolve, 0, slot.read, 0, slot.count * 8);
        originalSubmit.call(device2.queue, [encoder3.finish()]);
        errors = device2.popErrorScope();
        void Promise.allSettled([slot.read.mapAsync(1, 0, slot.count * 8), errors]).then(([mapped, validation]) => {
          if (disposed) return;
          if (mapped.status !== "fulfilled" || validation.status !== "fulfilled" || validation.value) throw Error("GPU readback or validation invalidated timestamp capture");
          const values2 = new Uint64(slot.read.getMappedRange(0, slot.count * 8));
          let elapsed = 0n;
          for (let i2 = 0; i2 < slot.count; i2 += 2) {
            if (values2[i2] === 0n || values2[i2 + 1] === 0n || values2[i2 + 1] < values2[i2]) throw Error("Invalid GPU timestamp pair");
            elapsed += values2[i2 + 1] - values2[i2];
          }
          const ms = Number(elapsed) / 1e6;
          if (!finite3(ms) || ms < 0 || slot.invalid) throw Error("Invalid GPU result");
          const raw = captureRaw ? freeze3({ timestampsNs: freeze3(Array.from(values2.subarray(0, slot.count), (value) => value.toString())), passCount: slot.count / 2, submittedBuffers: slot.submitted }) : void 0;
          if (onSample(slot.frame, ms, !slot.nonPass, raw) === false) droppedSamples++;
          else completedSamples++;
        }).catch(() => {
          if (!disposed) failedSamples++;
        }).finally(() => {
          try {
            slot.read.unmap();
          } catch {
          }
          slot.busy = false;
        });
      } catch {
        failedSamples++;
        if (!errors) closeFailed(slot);
        else void errors.catch(() => {
        }).finally(() => {
          slot.busy = false;
        });
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      active = null;
      release();
    }
  };
  let originalEncoder, originalSubmit;
  if (mode === "baseline") {
    reason = "GPU timing disabled in baseline mode";
    return freeze3(api);
  }
  if (supported !== true) return freeze3(api);
  try {
    originalEncoder = device2.createCommandEncoder;
    originalSubmit = device2.queue.submit;
    if (typeof originalEncoder !== "function" || typeof device2.createQuerySet !== "function" || typeof device2.createBuffer !== "function" || typeof originalSubmit !== "function" || typeof device2.pushErrorScope !== "function" || typeof device2.popErrorScope !== "function") throw Error("GPU query API unavailable");
    for (let i2 = 0; i2 < 3; i2++) {
      const slot = { busy: false, count: 0, invalid: false, frame: 0, submitted: 0 };
      slots.push(slot);
      slot.query = device2.createQuerySet({ type: "timestamp", count: 256 });
      slot.resolve = device2.createBuffer({ size: 2048, usage: 512 | 4 });
      slot.read = device2.createBuffer({ size: 2048, usage: 1 | 8 });
    }
    replace(device2, "createCommandEncoder", function(...args) {
      const encoder3 = originalEncoder.apply(device2, args);
      if (!active) return encoder3;
      const meta = { slot: null, frame: 0, nonPass: false };
      try {
        for (const name of ["beginRenderPass", "beginComputePass"]) {
          const original = encoder3[name];
          if (typeof original !== "function") {
            if (active) active.invalid = true;
            continue;
          }
          define(encoder3, name, { configurable: true, value: function(input = {}) {
            const slot = active;
            if (!slot) return original.call(encoder3, input);
            if (meta.slot && (meta.slot !== slot || meta.frame !== slot.frame)) {
              if (meta.slot.frame === meta.frame) meta.slot.invalid = true;
              slot.invalid = true;
            }
            meta.slot = slot;
            meta.frame = slot.frame;
            if (input.timestampWrites || slot.count >= 256) {
              slot.invalid = true;
              return original.call(encoder3, input);
            }
            const first = slot.count;
            slot.count += 2;
            return original.call(encoder3, { ...input, timestampWrites: { querySet: slot.query, beginningOfPassWriteIndex: first, endOfPassWriteIndex: first + 1 } });
          } });
        }
        for (const name of ["copyBufferToBuffer", "copyBufferToTexture", "copyTextureToBuffer", "copyTextureToTexture", "clearBuffer"]) if (typeof encoder3[name] === "function") {
          const original = encoder3[name];
          define(encoder3, name, { configurable: true, value: function(...args2) {
            meta.nonPass = true;
            if (active) active.nonPass = true;
            return original.apply(encoder3, args2);
          } });
        }
        const finish = encoder3.finish;
        define(encoder3, "finish", { configurable: true, value: function(...args2) {
          const result = finish.apply(encoder3, args2);
          commands.set(result, meta);
          return result;
        } });
      } catch {
        if (active) active.invalid = true;
        reason = "Command encoder instrumentation unavailable";
      }
      return encoder3;
    });
    replace(device2.queue, "submit", function(buffers) {
      if (active) {
        if (!Array.isArray(buffers)) active.invalid = true;
        else for (const buffer of buffers) {
          const meta = commands.get(buffer);
          if (!meta || meta.slot !== active || meta.frame !== active.frame) active.invalid = true;
          else {
            active.submitted++;
            if (meta.nonPass) active.nonPass = true;
          }
        }
      }
      return originalSubmit.call(device2.queue, buffers);
    });
    for (const name of ["writeBuffer", "writeTexture", "copyExternalImageToTexture"]) if (typeof device2.queue[name] === "function") {
      const original = device2.queue[name];
      replace(device2.queue, name, function(...args) {
        if (active) active.nonPass = true;
        return original.apply(device2.queue, args);
      });
    }
    enabled = true;
    reason = "Render and compute pass timestamps; copies, uploads and clears outside passes are excluded";
  } catch {
    reason = "GPU query instrumentation unavailable";
    release();
  }
  return freeze3(api);
}

// apps/studio/src/visual-worker.mjs
var freeze4 = Object.freeze;
var now = performance.now.bind(performance);
var post = postMessage.bind(globalThis);
var identity2;
var renderer;
var device;
var visual;
var clock;
var random;
var settings;
var outputTarget;
var presentation;
var controlState;
var frame = 0;
var tick = 0;
var lastTime = 0;
var drawStarted = 0;
var scheduleEpoch = 0;
var performanceMode = "routine";
var referenceTimer;
var diagnosticAdapter;
var diagnosticRaw = [];
function diagnosticSample(timer2, frame2, ms, complete, raw) {
  if (diagnosticRaw.length >= 64) return false;
  diagnosticRaw.push({ timer: timer2, frame: frame2, ms, complete, raw });
  return true;
}
var stopped = false;
var externallyDriven = false;
var timer;
var heartbeat;
var telemetryTimer;
var collector;
var gpuTimer;
var gpuCapability;
var chain = Promise.resolve();
var send = (type, extra = {}) => post({ type, ...identity2, ...extra });
function state() {
  return { ...clock.snapshot(), frameId: String(frame), ...controlState.state() };
}
function failure(error, requestId) {
  stopped = true;
  clearTimeout(timer);
  clearInterval(heartbeat);
  clearInterval(telemetryTimer);
  gpuTimer?.dispose();
  referenceTimer?.dispose();
  send("failure", { requestId, code: "RUNTIME_FAILED", message: String(error?.message || error).slice(0, 2e3) });
}
async function draw(requestId, type = "frame") {
  drawStarted = now();
  const time = clock.snapshot();
  const profiling = performanceMode === "routine";
  referenceTimer.begin(frame + 1);
  if (profiling) gpuTimer.begin(frame + 1);
  const updateStart = profiling ? now() : 0;
  visual.update(freeze4({
    tick: tick++,
    timeSeconds: time.timeSeconds,
    deltaSeconds: Math.max(0, time.timeSeconds - lastTime),
    controls: controlState.values(),
    events: freeze4([])
  }));
  const updateEnd = profiling ? now() : 0;
  const renderResult = visual.render(freeze4({ width: settings.width, height: settings.height, colorSpace: "linear-srgb", alphaMode: "premultiplied" }));
  const renderCallEnd = profiling ? now() : 0;
  const asynchronous = profiling && renderResult != null && typeof renderResult.then === "function";
  await renderResult;
  const renderEnd = profiling ? now() : 0;
  await device.queue.onSubmittedWorkDone();
  const completed = now();
  lastTime = time.timeSeconds;
  frame++;
  if (profiling) {
    collector.record(completed, frame, updateEnd - updateStart, renderCallEnd - updateEnd, completed - renderEnd, asynchronous, renderEnd - renderCallEnd);
    gpuTimer.end();
  } else collector.record(completed, frame);
  referenceTimer.end();
  send(type, { requestId, ...state(), timeSeconds: time.timeSeconds });
}
function schedule() {
  clearTimeout(timer);
  const epoch = ++scheduleEpoch;
  if (stopped || externallyDriven || clock.snapshot().playback !== "playing") return;
  const delay = Math.max(0, drawStarted + 1e3 / settings.fps - now());
  timer = setTimeout(() => {
    chain = chain.then(async () => {
      if (!stopped && epoch === scheduleEpoch && clock.snapshot().playback === "playing") {
        await draw();
        schedule();
      }
    }).catch(failure);
  }, delay);
}
async function initialize(message) {
  identity2 = { instanceId: message.instanceId, generation: message.generation, revisionId: message.revisionId };
  externallyDriven = message.externallyDriven === true;
  performanceMode = collectionMode(message.performanceMode);
  settings = message.settings;
  if (!settings || settings.width !== 1920 || settings.height !== 1080 || settings.fps !== 60 || !Number.isInteger(settings.seed) || settings.seed < 0 || settings.seed > 4294967295) throw Error("Unsupported output settings");
  controlState = await prepareWorkerControlState(message);
  clock = new RuntimeClock(() => performance.now(), "paused");
  random = new SeededRandom(settings.seed);
  let workerHeartbeat = 0;
  const beat = () => send("heartbeat", { frameId: String(frame), workerHeartbeat: ++workerHeartbeat });
  heartbeat = setInterval(beat, 250);
  beat();
  const { module, assets, images } = await loadAuthoredModule(message, async (moduleSource) => {
    const url = URL.createObjectURL(new Blob([moduleSource], { type: "text/javascript" }));
    try {
      return await import(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  });
  const create = controlState.checkDefinition(module);
  if (!navigator.gpu) throw Error("WebGPU is unavailable");
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) throw Error("No WebGPU adapter available");
  gpuCapability = freeze4({ timestampQuerySupported: typeof adapter.features?.has === "function" ? adapter.features.has("timestamp-query") : null, timestampQueryEnabled: false });
  device = await adapter.requestDevice(gpuCapability.timestampQuerySupported ? { requiredFeatures: ["timestamp-query"] } : {});
  diagnosticAdapter = { vendor: adapter.info?.vendor, architecture: adapter.info?.architecture, device: adapter.info?.device, description: adapter.info?.description };
  referenceTimer = createGpuPassTimer(device, (...args) => diagnosticSample("reference", ...args), { captureRaw: true, sampleFrame: (frame2) => frame2 >= 16 && (frame2 - 16) % 30 === 0 });
  gpuTimer = createGpuPassTimer(device, (frame2, ms, complete, raw) => {
    diagnosticSample("routine", frame2, ms, complete, raw);
    return collector?.recordGpu(frame2, ms, complete) ?? false;
  }, { mode: performanceMode, captureRaw: true });
  device.lost.then((info) => {
    if (!stopped) failure(Error(`WebGPU device lost: ${info.message}`));
  });
  renderer = new module.WebGPURenderer({ canvas: message.canvas, device, alpha: true, antialias: false });
  renderer.setSize(settings.width, settings.height, false);
  await renderer.init();
  if (!renderer.backend.isWebGPUBackend) throw Error("WebGPU backend required");
  outputTarget = new module.RenderTarget(settings.width, settings.height);
  outputTarget.texture.colorSpace = module.SRGBColorSpace;
  const material = new module.MeshBasicNodeMaterial();
  material.fragmentNode = module.sampleTexture(outputTarget.texture);
  presentation = new module.QuadMesh(material);
  visual = await create(freeze4({
    settings: freeze4({ ...settings }),
    assets,
    images,
    random: () => random.next(),
    reportError: (value) => {
      throw Error(String(value));
    },
    renderer: freeze4({ render: (scene, camera) => {
      renderer.setRenderTarget(outputTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      presentation.render(renderer);
    } })
  }));
  for (const name of ["update", "render", "reset", "dispose"]) if (typeof visual?.[name] !== "function") throw Error(`Visual missing ${name}`);
  collector = createFrameCollector({ startMs: now(), mode: performanceMode });
  telemetryTimer = setInterval(() => {
    if (!stopped) send("performance", { summary: collector.summary(now(), { ...gpuTimer.status(), timestampQuerySupported: gpuCapability.timestampQuerySupported }) });
  }, 500);
  if (message.playing) clock.play();
  await draw(message.requestId, "ready");
  schedule();
}
onmessage = (event) => {
  const message = event.data;
  chain = chain.then(async () => {
    if (!identity2 && message?.type === "init") return initialize(message);
    if (stopped || !identity2 || message.instanceId !== identity2.instanceId || message.generation !== identity2.generation) return;
    if (message.type === "diagnostic-finalize") {
      const until = performance.now() + 5e3;
      while ((referenceTimer.status().pendingSamples || gpuTimer.status().pendingSamples) && performance.now() < until) await new Promise((resolve) => setTimeout(resolve, 10));
      send("diagnostic-finalize", { requestId: message.requestId, raw: diagnosticRaw, reference: referenceTimer.status(), routine: gpuTimer.status(), adapter: diagnosticAdapter, performanceMode, ...state() });
    } else if (message.type === "frame") {
      await draw(message.requestId, "frame");
      schedule();
    } else if (message.type === "controls") {
      controlState.apply(message.values, message.controlSequence, message.controlSchemaHash);
      await draw(message.requestId, "status");
      schedule();
    } else if (message.type === "playback") {
      if (!["play", "pause", "reset"].includes(message.action)) throw Error("Invalid playback command");
      clearTimeout(timer);
      if (message.action === "reset") {
        clock.reset();
        random.reset(settings.seed);
        await visual.reset(settings.seed);
        lastTime = 0;
        tick = 0;
      } else clock[message.action]();
      await draw(message.requestId, "status");
      schedule();
    } else if (message.type === "capture") {
      try {
        const pixels = await renderer.readRenderTargetPixelsAsync(outputTarget, 0, 0, settings.width, settings.height);
        const png = encodeCapturedTarget(pixels, settings.width, settings.height);
        const bytes = png.slice().buffer;
        const metadata = { ...state(), timeSeconds: lastTime, width: settings.width, height: settings.height, seed: settings.seed, colorSpace: "srgb", alphaMode: "straight" };
        postMessage({ type: "capture", ...identity2, requestId: message.requestId, metadata, bytes }, [bytes]);
      } catch (error) {
        send("capture-error", { requestId: message.requestId, message: String(error.message) });
      }
    } else if (message.type === "dispose") {
      stopped = true;
      clearTimeout(timer);
      clearInterval(heartbeat);
      clearInterval(telemetryTimer);
      gpuTimer.dispose();
      referenceTimer.dispose();
      await visual.dispose();
      outputTarget.dispose();
      presentation.material.dispose();
      renderer.dispose();
      device.destroy();
      send("diagnostic-disposed", { requestId: message.requestId });
      close();
    }
  }).catch((error) => failure(error, message?.requestId));
};
/*! lux-worker-liveness-v2: heartbeat starts before authored import/create. */
