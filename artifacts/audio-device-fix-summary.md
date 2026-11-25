Implemented pre-connect system audio input discovery and exact input selection for Studio.

The selector now lists Windows audio inputs before the first successful capture. A failed Default connection leaves CABLE Output selectable for an exact retry. A missing saved device stays explicit and blocks silent fallback. Device changes refresh the list.

The Electron broker now accepts only the observed Electron 44 main-frame audio check shapes. Discovery has its own short-lived arm and cannot authorize capture. Pending and active capture arms are preserved during refresh.

Source commit: de0226d5973740f2703ebf54479529e0df950875

Status: implemented and demonstrated in an isolated checkout profile. Root owns independent review, integration, and installed-app delivery.
