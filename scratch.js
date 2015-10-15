var i0 = r.runtimeImport("join"), i1 = r.runtimeImport("buildFormatter"), b0 = i1("%x received"), i2 = r.runtimeImport("defineChannel"), i3 = r.runtimeImport("joinArguments");
function s(c, x) {
  var h0, h1, v3;
  h0 = i0(function (v0) {
    var _;
    var v1 = c["emit"];
    _ = v1(b0({"x": v0}));
    return _;
  }, 1);
  v3 = i2(function (v2) {
    h1 = i3(arguments);
    return h0(0, h1);
  });
  return v3;
}
