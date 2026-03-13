"use client"

import { usePathname } from "next/navigation";
import LiveMatchesModal from "./LiveMatchesModal";

const LiveMatchesController = () => {
    const pathname = usePathname();

    if (pathname?.startsWith("/overlay")) {
        return null;
    }

    return <LiveMatchesModal />;
};

export default LiveMatchesController;