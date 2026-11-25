LUX-190 source candidate is commit fa6dd785779ede559667e29afe7aa47915bc7697.

The connected Monitor button uses aria-pressed state and shows Monitor on while active. It reuses the active capture stream and adds one source route to the active AudioContext destination. It disconnects that route and resets state on disconnect, unavailable capture, dispose, or a route failure. No second capture or operating-system output change occurs.
