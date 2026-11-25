LUX-139: Studio accepts controls by validated metadata size, without a fixed count ceiling. This covers scenes, components, exposed aliases, batch writes and local animation bindings. Discovery and author guidance match the behavior. The existing Resolume transport limit is explicit at export.

Large component scenes remain responsive because immutable composition admission is reused while each value snapshot is still validated. Main contains reviewed commit416d4640f7db7dd01034f37102b33455eb760fe8. Source/native screenshots, regression/type checks, skill parity and package evidence are linked in control-limit-evidence.md. Unrelated work and the user's running app are preserved.

Known separate issue: LUX-140 tracks repeated-replacement startup timeouts reproduced on both this candidate and the previous packaged build. That defect is not claimed fixed.
