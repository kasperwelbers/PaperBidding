"use client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { FaHome, FaWindowClose } from "react-icons/fa";
import { MdCelebration } from "react-icons/md";

export default function Test() {
  const router = useRouter();
  return (
    <main className="flex min-h-screen flex-col items-center">
      <header className="min-h-[3.5rem] w-full bg-primary flex justify-center">
        <div className="flex z-20 px-4 lg:px-10 py-1 max-w-7xl sticky top-0 w-full justify-center items-center  text-white">
          <div className="flex flex-col md:flex-row w-full justify-between">
            <div className="flex flex-wrap md:flex-col py-2 gap-x-3 justify-between ">
              <h5 className="m-0">ICA Paper bidding</h5>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              className=" flex whitespace-nowrap  m-0 gap-3 h-min hover:bg-transparent hover:text-white"
              variant="ghost"
              onClick={() => router.push("/")}
            >
              <FaHome size={20} />
            </Button>
          </div>
        </div>
      </header>
      <div className="h-[80vh] flex flex-col justify-center items-center">
        <div className="flex flex-col items-center">
          <h3>Welcome back!</h3>
          <p>{"We're so happy your test email went well!"}</p>
          <div className="h-6"></div>
          <MdCelebration size={60} />
        </div>
      </div>
    </main>
  );
}
